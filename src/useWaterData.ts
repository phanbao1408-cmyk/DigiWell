import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from './lib/supabase';
import {
  calculateWaterTotal,
  clearPendingWaterSync,
  getPendingWaterSync,
  getTodayWaterDay,
  listPendingWaterSyncs,
  loadStoredWaterEntries,
  saveStoredWaterEntries,
  upsertPendingWaterSync,
  type WaterEntry,
} from './lib/waterStorage';

// FIX BUG: Định nghĩa thêm trường actual_ml để tránh lỗi TypeScript khi dùng WaterEntry
export type LocalWaterEntry = WaterEntry & { actual_ml?: number };

export function useWaterData(profile: any) {
  const [waterIntake, setWaterIntake] = useState(0);
  const [waterEntries, setWaterEntries] = useState<LocalWaterEntry[]>([]);
  const [hasPendingCloudSync, setHasPendingCloudSync] = useState(false);
  // Add new states for editing
  const [editingEntry, setEditingEntry] = useState<LocalWaterEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');

  // Sử dụng Ref để có giá trị mới nhất trong các hàm async mà không cần đưa vào dependency array
  const waterEntriesRef = useRef<LocalWaterEntry[]>([]);
  const waterIntakeRef = useRef(0);
  const hasPendingCloudSyncRef = useRef(false);

  useEffect(() => {
    waterEntriesRef.current = waterEntries;
  }, [waterEntries]);

  useEffect(() => {
    waterIntakeRef.current = waterIntake;
  }, [waterIntake]);

  useEffect(() => {
    hasPendingCloudSyncRef.current = hasPendingCloudSync;
  }, [hasPendingCloudSync]);

  useEffect(() => {
    if (!profile?.id) return;

    void flushPendingWaterSyncs(true);

    const handleOnline = () => {
      void flushPendingWaterSyncs();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [profile?.id]);

  const fetchTodayWaterCloud = async (userId: string) => {
    try {
      const todayStr = getTodayWaterDay();
      const { data, error } = await supabase!
        .from('water_logs')
        .select('intake_ml')
        .eq('user_id', userId)
        .eq('day', todayStr)
        .maybeSingle();
      if (error) throw error;
      return data ? data.intake_ml : 0;
    } catch {
      return null;
    }
  };

  // Load dữ liệu nước trong ngày theo local-first
  useEffect(() => {
    if (!profile?.id) {
        setWaterEntries([]);
        setWaterIntake(0);
        return;
    };

    const todayStr = getTodayWaterDay();
    const localEntries = loadStoredWaterEntries(profile.id, todayStr);
    const localTotal = calculateWaterTotal(localEntries);
    const pendingSync = getPendingWaterSync(profile.id, todayStr);

    waterEntriesRef.current = localEntries;
    waterIntakeRef.current = localTotal;
    setWaterEntries(localEntries);
    setWaterIntake(localEntries.length > 0 ? localTotal : pendingSync?.total || 0);
    setHasPendingCloudSync(Boolean(pendingSync));

    void (async () => {
      const cloudTotal = await fetchTodayWaterCloud(profile.id);
      if (cloudTotal !== null && localEntries.length === 0 && !pendingSync) {
        waterIntakeRef.current = cloudTotal;
        setWaterIntake(cloudTotal);
      }
    })();
  }, [profile?.id]);

  const saveEntries = (entries: LocalWaterEntry[]) => {
    if (!profile?.id) return;
    saveStoredWaterEntries(profile.id, entries, getTodayWaterDay());
  };

  const flushPendingWaterSyncs = async (silent: boolean = false) => {
    if (!profile?.id) return false;

    const pendingSyncs = listPendingWaterSyncs(profile.id).sort((a, b) => a.updatedAt - b.updatedAt);
    if (pendingSyncs.length === 0) {
      setHasPendingCloudSync(false);
      return true;
    }

    try {
      for (const sync of pendingSyncs) {
        const { error } = await supabase!.from('water_logs').upsert({
          user_id: sync.userId,
          day: sync.day,
          intake_ml: sync.total,
        }, { onConflict: 'user_id,day' });
        if (error) throw error;

        clearPendingWaterSync(sync.userId, sync.day);
      }

      setHasPendingCloudSync(false);
      if (!silent) {
        toast.success(`Đã đồng bộ ${pendingSyncs.length} bản ghi offline lên Cloud!`);
      }
      return true;
    } catch {
      setHasPendingCloudSync(true);
      return false;
    }
  };


  const syncTotalToCloud = async (total: number, options?: { silent?: boolean }) => {
    if (!profile?.id) return;
    const todayStr = getTodayWaterDay();

    try {
      const { error } = await supabase!.from('water_logs').upsert({
        user_id: profile.id,
        day: todayStr,
        intake_ml: total,
      }, { onConflict: 'user_id,day' });
      if (error) throw error;

      clearPendingWaterSync(profile.id, todayStr);
      setHasPendingCloudSync(false);
      await flushPendingWaterSyncs(true);
    } catch {
      upsertPendingWaterSync({
        userId: profile.id,
        day: todayStr,
        total,
        updatedAt: Date.now(),
      });
      setHasPendingCloudSync(true);

      if (!options?.silent && !hasPendingCloudSyncRef.current) {
        toast.warning("Đã lưu offline. DigiWell sẽ tự đồng bộ khi có mạng lại.");
      }
    }
  };

  const handleAddWater = (amount: number, factor: number = 1.0, name: string = 'Nước lọc'): Promise<number> => new Promise(resolve => {
    if (!profile?.id) {
      toast.error("Vui lòng đăng nhập lại!");
      return resolve(waterIntakeRef.current);
    }
    const actualHydration = Math.round(amount * factor);
    const entry: LocalWaterEntry = { id: Date.now().toString(), amount, actual_ml: actualHydration, name, timestamp: Date.now() };

    setWaterEntries(prevEntries => {
      const newEntries = [...prevEntries, entry];
      const newTotal = calculateWaterTotal(newEntries);
      setWaterIntake(newTotal);
      saveEntries(newEntries);
      if (factor < 0) {
        toast.error(`Đã uống ${name}. Mất ${Math.abs(actualHydration)}ml lượng nước cơ thể! 📉`);
      } else {
        toast.success(`+${actualHydration}ml (${name})! Đã lưu vào nhật ký hôm nay.`);
      }
      void syncTotalToCloud(newTotal);
      resolve(newTotal);
      return newEntries;
    });
  });

  const handleDeleteEntry = (id: string): Promise<number> => new Promise(resolve => {
    if (!profile?.id) return resolve(waterIntakeRef.current);
    setWaterEntries(prevEntries => {
      const newEntries = prevEntries.filter(e => e.id !== id);
      const newTotal = calculateWaterTotal(newEntries);
      setWaterIntake(newTotal);
      saveEntries(newEntries);
      toast.success("Đã xóa ghi nhận!");
      void syncTotalToCloud(newTotal);
      resolve(newTotal);
      return newEntries;
    });
  });

  const handleEditEntry = (): Promise<number> => new Promise(resolve => {
    if (!editingEntry || !profile?.id) return resolve(waterIntakeRef.current);
    const newAmount = parseInt(editAmount);
    if (isNaN(newAmount) || newAmount <= 0) {
      toast.error("Số ml không hợp lệ!");
      return resolve(waterIntakeRef.current);
    }
    const currentName = editingEntry.name || 'Nước lọc';
    const updatedName = currentName.includes('(đã sửa)') ? currentName : `${currentName} (đã sửa)`;
    setWaterEntries(prevEntries => {
      const newEntries = prevEntries.map(e => e.id === editingEntry.id ? { ...e, amount: newAmount, actual_ml: newAmount, name: updatedName } : e);
      const newTotal = calculateWaterTotal(newEntries);
      setWaterIntake(newTotal);
      saveEntries(newEntries);
      toast.success("Đã cập nhật ghi nhận!");
      void syncTotalToCloud(newTotal);
      resolve(newTotal);
      return newEntries;
    });
    setEditingEntry(null);
    setEditAmount('');
  });

  return {
    waterIntake,
    waterEntries,
    editingEntry,
    setEditingEntry,
    editAmount,
    setEditAmount,
    handleAddWater,
    handleDeleteEntry,
    handleEditEntry,
    hasPendingCloudSync,
    waterIntakeRef,
    waterEntriesRef,
  };
}