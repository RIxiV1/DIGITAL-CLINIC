import TrendRow from '../../components/TrendRow';
import {
  type Biomarker,
  type BiomarkerCategoryId,
} from '../../data/biomarkers';
import { getMarkerInfo } from '../../data/markerInfo';

/* ------------------------------------------------------------------ */
/* TrendsPane — body of the "Compare to your last report" disclosure  */
/* Same pathway-grouped sparkline rows that used to sit always-on;    */
/* now rendered only when the parent disclosure is open.              */
/* ------------------------------------------------------------------ */

export default function TrendsPane({
  trendsByPathway,
  asOf,
  openLearnMore,
}: {
  trendsByPathway: Array<{
    id: string;
    name: string;
    categories: BiomarkerCategoryId[];
    markers: Biomarker[];
  }>;
  asOf?: string;
  openLearnMore: (name: string) => (e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid gap-3">
      {trendsByPathway.map((group) => {
        const borderClass =
          group.id === 'hormonal'
            ? 'border-l-4 border-l-attention'
            : group.id === 'metabolic'
              ? 'border-l-4 border-l-indigo-600'
              : group.id === 'nutritional'
                ? 'border-l-4 border-l-good'
                : '';
        return (
          <div
            key={group.id}
            className={`rounded-[18px] bg-canvas/40 border border-line/70 ${borderClass} overflow-hidden`}
          >
            <div className="px-4 pt-4 pb-1">
              <div className="text-micro uppercase tracking-eyebrow font-bold text-indigo-700">
                {group.name}
              </div>
            </div>
            <div className="px-4 pb-2">
              {group.markers.map((m) => (
                <TrendRow
                  key={m.id}
                  marker={m}
                  asOf={asOf}
                  onLearnMore={
                    getMarkerInfo(m.name) ? openLearnMore(m.name) : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
