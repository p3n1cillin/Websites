import type { Business } from "@/lib/types";
import { ClockIcon } from "./Icons";
import OpenNow from "./OpenNow";

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export default function OpeningHours({
  business,
  className = "",
}: {
  business: Business;
  className?: string;
}) {
  const todayIndex = new Date().getDay();

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-bold text-gray-900">Opening Hours</h3>
        </div>
        <OpenNow business={business} />
      </div>
      <ul className="mt-4 divide-y divide-gray-100">
        {business.openingHours.map((entry) => {
          const isToday = DAY_INDEX[entry.day.toLowerCase()] === todayIndex;
          const closed = /closed/i.test(entry.hours);
          return (
            <li
              key={entry.day}
              className={`flex items-center justify-between py-2.5 text-sm ${
                isToday ? "font-semibold text-gray-900" : "text-gray-600"
              }`}
            >
              <span className="flex items-center gap-2">
                {entry.day}
                {isToday && (
                  <span className="rounded-full bg-brand-light/60 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    Today
                  </span>
                )}
              </span>
              <span className={closed ? "text-gray-400" : ""}>{entry.hours}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
