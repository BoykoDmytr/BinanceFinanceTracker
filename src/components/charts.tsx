import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { dateShort } from '../lib/format';
import { colors } from '../lib/theme';

interface SeriesPoint {
  date: string;
  value: number;
}

const H = 150;
const PAD_TOP = 10;
const PAD_BOTTOM = 4;

function useMeasuredWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}

/** Лінійний графік з градієнтною заливкою. */
export function LineChart({
  data,
  color = colors.gold,
  formatValue,
}: {
  data: SeriesPoint[];
  color?: string;
  formatValue: (v: number) => string;
}) {
  const [width, onLayout] = useMeasuredWidth();
  if (data.length < 2) return <View onLayout={onLayout} />;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => (width * i) / (data.length - 1);
  const y = (v: number) => PAD_TOP + innerH * (1 - (v - min) / span);

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${H} L0,${H} Z`;
  const last = data[data.length - 1];
  const gid = `grad-${color.replace('#', '')}`;

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
              <Stop offset="0" stopColor={color} stopOpacity={0.35} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#${gid})`} />
          <Path d={line} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={x(data.length - 1)} cy={y(last.value)} r={4} fill={color} />
        </Svg>
      )}
      <View style={styles.chartAxis}>
        <Text style={styles.axisLabel}>{dateShort(data[0].date)}</Text>
        <Text style={styles.axisLabel}>{dateShort(last.date)}</Text>
      </View>
    </View>
  );
}

/** Стовпчиковий графік (обсяг по днях). */
export function BarChart({
  data,
  color = colors.blue,
  formatValue,
}: {
  data: SeriesPoint[];
  color?: string;
  formatValue: (v: number) => string;
}) {
  const [width, onLayout] = useMeasuredWidth();
  if (data.length === 0) return <View onLayout={onLayout} />;

  const max = Math.max(...data.map((d) => d.value)) || 1;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const step = width / data.length;
  const barW = Math.max(1.5, step * 0.65);

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
      <View style={styles.chartAxis}>
        <Text style={styles.axisLabel}>{dateShort(data[0].date)}</Text>
        <Text style={styles.axisLabel}>{dateShort(data[data.length - 1].date)}</Text>
      </View>
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
