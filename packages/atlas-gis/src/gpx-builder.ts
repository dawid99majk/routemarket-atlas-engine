import type { RoutingResult } from './routing/types.js';
import type { Poi } from '../../atlas-core/src/index.js';

export function buildGpxXml(route: RoutingResult, waypoints?: Poi[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx version="1.1" creator="RouteMarket Atlas Engine" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">');
  
  lines.push('  <metadata>');
  lines.push(`    <time>${now}</time>`);
  lines.push('  </metadata>');

  // Add Waypoints
  if (waypoints && waypoints.length > 0) {
    for (const wpt of waypoints) {
      lines.push(`  <wpt lat="${wpt.lat.toFixed(6)}" lon="${wpt.lng.toFixed(6)}">`);
      lines.push(`    <name>${escapeXml(wpt.name)}</name>`);
      if (wpt.description) {
        lines.push(`    <desc>${escapeXml(wpt.description)}</desc>`);
      }
      lines.push(`    <type>${wpt.type}</type>`);
      lines.push('  </wpt>');
    }
  }

  // Add Track
  lines.push('  <trk>');
  lines.push('    <name>Generated Route</name>');
  lines.push('    <trkseg>');
  
  for (const pt of route.points) {
    lines.push(`      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}" />`);
  }

  lines.push('    </trkseg>');
  lines.push('  </trk>');

  lines.push('</gpx>');

  return lines.join('\n');
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}
