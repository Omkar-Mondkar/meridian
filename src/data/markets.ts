/** Multi-market clock configuration (Design Doc §5.4). */
export interface Market {
  key: string;
  flag: string;
  name: string;
  tz: string;
  open: string;  // "HH:MM" in market's local time
  close: string;
}

export const MARKETS: Market[] = [
  { key: 'IST', flag: '🇮🇳', name: 'India · NSE/BSE',      tz: 'Asia/Kolkata',    open: '09:15', close: '15:30' },
  { key: 'US',  flag: '🇺🇸', name: 'United States · NYSE', tz: 'America/New_York', open: '09:30', close: '16:00' },
  { key: 'KR',  flag: '🇰🇷', name: 'South Korea · KRX',    tz: 'Asia/Seoul',       open: '09:00', close: '15:30' },
];
