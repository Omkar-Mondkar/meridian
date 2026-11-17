/** Multi-market clock configuration (Design Doc §5.4). */
export interface Market {
  key: string;
  countryCode: string;
  flag: string;
  name: string;
  tz: string;
  open: string;  // "HH:MM" in market's local time
  close: string;
}

export const MARKETS: Market[] = [
  { key: 'IST', countryCode: 'IN', flag: 'IN', name: 'India · NSE/BSE',      tz: 'Asia/Kolkata',    open: '09:15', close: '15:30' },
  { key: 'US',  countryCode: 'US', flag: 'US', name: 'United States · NYSE', tz: 'America/New_York', open: '09:30', close: '16:00' },
  { key: 'KR',  countryCode: 'KR', flag: 'KR', name: 'South Korea · KRX',    tz: 'Asia/Seoul',       open: '09:00', close: '15:30' },
];
