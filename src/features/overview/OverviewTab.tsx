import React, { useState, useCallback } from 'react';
import { TickerGrid } from './TickerGrid';
import { OnDutyMini } from './OnDutyMini';
import { TaskSnapshot } from './TaskSnapshot';
import { MarketClockCarousel } from '../../components/clock/MarketClockCarousel';
import { Panel } from '../../components/ui/Panel';

interface OverviewTabProps {
  onLiveChipChange: (label: string | null) => void;
}

export function OverviewTab({ onLiveChipChange }: OverviewTabProps) {
  return (
    <section className="view active" id="view-overview" role="tabpanel" aria-labelledby="tab-overview">
      <div className="overview-grid">
        <div>
          <TickerGrid />
        </div>
        <div className="side-col">
          <MarketClockCarousel onLiveChipChange={onLiveChipChange} />
          <Panel className="mini-panel">
            <div className="mini-title">On duty now</div>
            <OnDutyMini />
          </Panel>
          <Panel className="mini-panel">
            <div className="mini-title">Task snapshot</div>
            <TaskSnapshot />
          </Panel>
        </div>
      </div>
    </section>
  );
}
