
interface AutoActivityCardProps {
  isWatchConnected: boolean;
  isCalendarSynced: boolean;
  watchData: { heartRate: number; steps: number };
  calendarEvents: any[];
  currentActivity: 'chill' | 'light' | 'hard';
  setCurrentActivity: (activity: 'chill' | 'light' | 'hard') => void;
}

const AutoActivityCard = (props: AutoActivityCardProps) => {
  return (
    <div>
      AutoActivityCard placeholder
    </div>
  );
};

export default AutoActivityCard;