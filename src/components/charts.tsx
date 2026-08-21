import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { dateShort } from '../lib/format';
import { colors } from '../lib/theme';

interface SeriesPoint {
  date: string;
  value: number;
}

const H = 160;
const PAD_TOP = 14;
const PAD_BOTTOM = 6;
const DOT_R = 4;

function useMeasuredWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** До 4 підписів дат, рівномірно по осі (позиції збігаються з лінійною шкалою). */
function XAxis({ data }: { data: SeriesPoint[] }) {
  const n = data.length;
  const idx =
    n >= 4
      ? [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
      : data.map((_, i) => i);
  const labels = [...new Set(idx)].map((i) => dateShort(data[i].date));
  return (
    <View style={styles.chartAxis}>
      {labels.map((l, i) => (
        <Text key={`${l}-${i}`} style={styles.axisLabel}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function GridLines({
  width,
  min,
  max,
  y,
  format,
}: {
  width: number;
  min: number;
  max: number;
  y: (v: number) => number;
  format: (v: number) => string;
}) {
  const mid = (min + max) / 2;
  const levels = max === min ? [max] : [max, mid, min];
  return (
    <>
      {levels.map((v) => (
        <React.Fragment key={v}>
          <Line
            x1={0}
            y1={y(v)}
            x2={width}
            y2={y(v)}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
          <SvgText x={0} y={y(v) - 4} fill={colors.faint} fontSize={9}>
            {format(v)}
          </SvgText>
        </React.Fragment>
      ))}
    </>
  );
}

/** Лінійний графік з градієнтною заливкою, сіткою значень і підписами дат. */
export function LineChart({
  data,
  color = colors.gold,
  formatValue,
  formatAxis,
}: {
  data: SeriesPoint[];
  color?: string;
  formatValue: (v: number) => string;
  formatAxis?: (v: number) => string;
}) {
  const [width, onLayout] = useMeasuredWidth();
  if (data.length < 2) return <View onLayout={onLayout} />;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const plotW = width - DOT_R;

  const x = (i: number) => (plotW * i) / (data.length - 1);
  const y = (v: number) => PAD_TOP + innerH * (1 - (v - min) / span);

  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H} L0,${H} Z`;
  const last = data[data.length - 1];
  const gid = `grad-${color.replace('#', '')}`;
  const axisFmt = formatAxis ?? formatValue;

  return (
    <View onLayout={onLayout}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartValue, { color }]}>{formatValue(last.value)}</Text>
        <Text style={styles.chartMinMax}>
          мін {formatValue(min)} · макс {formatValue(max)}
        </Text>
      </View>
      {width > 0 && (
        <Svg width={width} height={H}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#${gid})`} />
          <GridLines width={width} min={min} max={max} y={y} format={axisFmt} />
          <Path d={line} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={x(data.length - 1)} cy={y(last.value)} r={DOT_R} fill={color} />
        </Svg>
      )}
      <XAxis data={data} />
    </View>
  );
}

/** Стовпчиковий графік (обсяг по днях). */
export function BarChart({
  data,
  color = colors.blue,
  formatValue,
  formatAxis,
}: {
  data: SeriesPoint[];
  color?: string;
  formatValue: (v: number) => string;
  formatAxis?: (v: number) => string;
}) {
  const [width, onLayout] = useMeasuredWidth();
  if (data.length === 0) return <View onLayout={onLayout} />;

  const max = Math.max(...data.map((d) => d.value)) || 1;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const step = width / data.length;
  const barW = Math.max(1.5, step * 0.65);
  const y = (v: number) => PAD_TOP + innerH * (1 - v / max);
  const axisFmt = formatAxis ?? formatValue;

  return (
    <View onLayout={onLayout}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartValue, { color }]}>
          {formatValue(data[data.length - 1].value)}
        </Text>
        <Text style={styles.chartMinMax}>макс {formatValue(max)}</Text>
      </View>
      {width > 0 && (
        <Svg width={width} height={H}>
          <GridLines width={width} min={0} max={max} y={y} format={axisFmt} />
          {data.map((d, i) => {
            const h = innerH * (d.value / max);
            return (
              <Rect
                key={d.date}
                x={i * step + (step - barW) / 2}
                y={H - PAD_BOTTOM - h}
                width={barW}
                height={Math.max(h, d.value > 0 ? 2 : 0)}
                rx={1.5}
                fill={color}
                opacity={i === data.length - 1 ? 1 : 0.55}
              />
            );
          })}
        </Svg>
      )}
      <XAxis data={data} />
    </View>
  );
}

const styles = StyleSheet.create({
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  chartValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chartMinMax: { color: colors.faint, fontSize: 11 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisLabel: { color: colors.faint, fontSize: 10 },
});
