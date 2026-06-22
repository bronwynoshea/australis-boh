export const cellarTheme = {
  color: {
    base: {
      blackCherry: '#120A10',
      blackCherryAlt: '#170D14',
      graphite: '#090711',
      graphiteSoft: '#1A1018',
      deepPlum: '#2A1724',
      oxbloodPlum: '#4A243B',
    },
    accent: {
      dustyMauve: '#A7829B',
      mauveLight: '#C2A0B6',
      softViolet: '#7A67D8',
      chamberViolet: '#8B6DE0',
    },
    text: {
      primary: '#F7F3F6',
      secondary: 'rgba(232, 214, 226, 0.68)',
      muted: 'rgba(214, 188, 205, 0.56)',
      faint: 'rgba(194, 160, 182, 0.42)',
      accent: 'rgba(194, 160, 182, 0.92)',
    },
    surface: {
      panel: '#160D14',
      panelRaised: 'rgba(18, 10, 16, 0.74)',
      field: 'rgba(9, 7, 17, 0.52)',
      control: 'rgba(247, 243, 246, 0.06)',
    },
    border: {
      subtle: 'rgba(233, 229, 234, 0.10)',
      visible: 'rgba(233, 229, 234, 0.14)',
      focus: 'rgba(167, 130, 155, 0.82)',
      field: 'rgba(167, 130, 155, 0.38)',
    },
    action: {
      primary: '#2B1328',
      primaryHover: '#4A243B',
      primaryShadow: 'rgba(43, 19, 40, 0.34)',
      focusRing: 'rgba(167, 130, 155, 0.14)',
    },
    brandMark: {
      frameStart: '#F0E9F0',
      frameMid: '#A989A0',
      frameEnd: '#59405A',
      chamberStart: '#8B6DE0',
      chamberEnd: '#2B1328',
      floorStart: '#F6F0F4',
      floorEnd: '#7C5B75',
    },
    semantic: {
      investorAccess: '#7C5B75',
      secondaryLink: 'rgba(194, 160, 182, 0.92)',
    },
  },
} as const;

export type CellarTheme = typeof cellarTheme;
