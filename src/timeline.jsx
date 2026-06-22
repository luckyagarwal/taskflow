// timeline.jsx — full-day, to-scale vertical timeline ("Day" view).
// Header + day nav; the hour grid itself is the shared DayTimeline component
// (src/daygrid.jsx), also used by the Calendar's Day mode.
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { ViewHeader } from './views.jsx';
import { DayTimeline } from './daygrid.jsx';

export function DayView({ compact }) {
  const [selOff, setSelOff] = useState(0);
  const selDate = H.dateFromOffset(selOff);

  return (
    <div>
      <ViewHeader
        icon={<span style={{ color: 'var(--accent)' }}><I.clock size={25} /></span>}
        title="Day"
        subtitle={`${H.DOW_LONG[selDate.getDay()]}, ${H.MONTHS_LONG[selDate.getMonth()]} ${selDate.getDate()}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" onClick={() => setSelOff((o) => o - 1)} aria-label="Previous day"><I.chevL size={18} /></button>
            <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px', fontWeight: 600 }} onClick={() => setSelOff(0)}>Today</button>
            <button className="icon-btn" onClick={() => setSelOff((o) => o + 1)} aria-label="Next day"><I.chevR size={18} /></button>
          </div>
        }
      />

      <DayTimeline selOff={selOff} compact={compact} />
    </div>
  );
}
