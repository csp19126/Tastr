import { useColorScheme } from 'react-native';

// Warm, foodie colours: chilli, turmeric, herb green on a rice-paper cream.
const light = {
  bg: '#FFF8EF',
  card: '#FFFFFF',
  cardAlt: '#FBEFDF',
  text: '#2B1D14',
  textDim: '#7A6556',
  line: '#EADBC8',
  primary: '#E2552B',
  primaryText: '#FFFFFF',
  green: '#2F7D5B',
  star: '#E8A33A',
  danger: '#C62828',
  sponsored: '#7B3FA0',
  overlay: 'rgba(43,29,20,0.45)',
};

const dark: typeof light = {
  bg: '#17110D',
  card: '#231A14',
  cardAlt: '#2E231B',
  text: '#F6EDE3',
  textDim: '#B9A595',
  line: '#3A2D24',
  primary: '#F06A3F',
  primaryText: '#FFFFFF',
  green: '#5DBB8E',
  star: '#F2B653',
  danger: '#EF5350',
  sponsored: '#C08BE0',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const radius = { s: 8, m: 12, l: 18, pill: 999 } as const;
export const font = { small: 13, body: 15, large: 17, title: 22, hero: 28 } as const;
