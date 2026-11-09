"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUSINESS_DAYS, OFFER_COUNT } from "@/lib/engine/config";

interface Point {
  day: string;
  actual: number | null;
  reference: number | null;
}

/** US-15 — cumulative published offers per day: actual (up to today) vs reference trajectory. */
export function ProgressChart({ actual, reference }: { actual: number[]; reference: number[] | null }) {
  const data: Point[] = Array.from({ length: BUSINESS_DAYS }, (_, i) => ({
    day: `J${i + 1}`,
    actual: i < actual.length ? actual[i] : null,
    reference: reference?.[i] ?? null,
  }));

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              domain={[0, OFFER_COUNT]}
              ticks={[0, 50, 100, 150, 200]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--foreground)",
                fontSize: 13,
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
              itemStyle={{ color: "var(--foreground)" }}
              formatter={(value, name) => [`${value} / ${OFFER_COUNT}`, name]}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="plainline"
              wrapperStyle={{ fontSize: 13 }}
              formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
            />
            <Line
              name="Référence (graine 42)"
              type="monotone"
              dataKey="reference"
              stroke="var(--series-2)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              name="Réel"
              type="monotone"
              dataKey="actual"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--series-1)", stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Voir les valeurs</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-max text-left text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="row" className="py-1 pr-3 font-medium">Jour</th>
                {data.map((p) => (
                  <th key={p.day} scope="col" className="px-1.5 py-1 font-medium">{p.day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="py-1 pr-3 font-medium">Réel</th>
                {data.map((p) => (
                  <td key={p.day} className="px-1.5 py-1">{p.actual ?? "—"}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-1 pr-3 font-medium">Référence</th>
                {data.map((p) => (
                  <td key={p.day} className="px-1.5 py-1">{p.reference ?? "—"}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
