import FadeImage from "../FadeImage";
import { useAuctionStore } from "../../store/auctionStore";

export default function LotPreview() {
  const config = useAuctionStore((s) => s.auction?.config);
  if (!config) return null;

  return (
    <div className="flex gap-4 items-start">
      {config.lot_image_path && (
        <FadeImage
          src={
            config.lot_image_path.startsWith("data:")
              ? config.lot_image_path
              : `asset://localhost/${config.lot_image_path}`
          }
          alt={config.lot_title}
          className="w-24 h-24 object-cover rounded-lg"
        />
      )}
      <div>
        <h2 className="text-xl font-bold">{config.lot_title}</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Старт: {config.starting_price.toLocaleString("ru-RU")} {config.currency_label}
        </p>
      </div>
    </div>
  );
}
