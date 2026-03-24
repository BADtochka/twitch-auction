import { LayoutGrid, Trophy } from 'lucide-react';
import BidList from '../components/BidList/BidList';
import LotPreview from '../components/LotPreview/LotPreview';
import ManualBidForm from '../components/ManualBidForm/ManualBidForm';
import Timer from '../components/Timer/Timer';
import { useAuction } from '../hooks/useAuction';

interface Props {
  onShowOverlays: () => void;
}

export default function Live({ onShowOverlays }: Props) {
  const { finishAuction } = useAuction();

  return (
    <div className='p-6 flex flex-col gap-5 h-screen overflow-hidden'>
      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <LotPreview />
        <div className='flex flex-col items-end gap-2'>
          <Timer />
          <button
            onClick={onShowOverlays}
            className='flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300'
          >
            <LayoutGrid size={12} />
            Виджеты
          </button>
        </div>
      </div>

      {/* Bids */}
      <div className='flex-1 overflow-y-auto'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='font-semibold text-zinc-300'>Ставки</h3>
          <ManualBidForm />
        </div>
        <BidList />
      </div>

      {/* Footer */}
      <div className='border-t border-zinc-700 pt-4'>
        <button
          onClick={() => finishAuction()}
          className='flex items-center justify-center gap-2 w-full px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-500 font-semibold'
        >
          <Trophy size={16} />
          Завершить аукцион
        </button>
      </div>
    </div>
  );
}
