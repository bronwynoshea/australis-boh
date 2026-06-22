export interface MockParticipant {
  id: string;
  name: string;
  isLocal: boolean;
  audio: boolean;
  video: boolean;
  avatarUrl?: string;
  videoTrack?: MediaStreamTrack;
  isVideoOn: boolean;
  isHost?: boolean;
}

// Generate realistic avatar URLs using DiceBear API
const generateAvatar = (seed: string, style: string = 'avataaars') => {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

// Realistic names for diversity
const MOCK_NAMES = [
  'Alex Chen',
  'Sarah Martinez',
  'James Wilson',
  'Priya Patel',
  'Mohamed Hassan',
  'Emma Johnson',
  'Carlos Rodriguez',
  'Yuki Tanaka',
  'Olivia Brown',
  'David Kim',
  'Fatima Ali',
  'Lucas Silva',
  'Aisha Williams',
  'Thomas Anderson',
  'Sofia Garcia',
  'Robert Lee',
  'Isabella Davis',
  'Daniel Cohen',
  'Maria Santos',
  'William Taylor',
];

// Generate mock video track (optional - for realistic video simulation)
const createMockVideoTrack = (): MediaStreamTrack | undefined => {
  try {
    // Create a canvas for fake video
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return undefined;
    
    // Draw a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 640, 480);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 480);
    
    // Animate the canvas (optional)
    let frame = 0;
    setInterval(() => {
      if (!ctx) return;
      const hue = (frame++ % 360);
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(
        Math.random() * 640,
        Math.random() * 480,
        50,
        50
      );
    }, 100);
    
    // Get stream from canvas
    const stream = (canvas as any).captureStream(30);
    return stream.getVideoTracks()[0];
  } catch (error) {
    console.warn('Could not create mock video track:', error);
    return undefined;
  }
};

/**
 * Generate mock participants for testing
 * @param count Number of participants to generate (default: 10)
 * @param includeVideo Whether to include mock video tracks (default: false for performance)
 */
export const generateMockParticipants = (
  count: number = 10,
  includeVideo: boolean = false
): MockParticipant[] => {
  const participants: MockParticipant[] = [];
  
  for (let i = 0; i < count; i++) {
    const name = MOCK_NAMES[i % MOCK_NAMES.length];
    const isLocal = i === 0; // First participant is local user
    const isHost = i === 1; // Second participant is host
    const hasAudio = Math.random() > 0.3; // 70% have audio on
    const hasVideo = Math.random() > 0.4; // 60% have video on
    
    participants.push({
      id: `mock-participant-${i}`,
      name: name,
      isLocal: isLocal,
      audio: hasAudio,
      video: hasVideo,
      avatarUrl: generateAvatar(name, [
        'avataaars',
        'bottts',
        'personas',
        'lorelei',
        'micah',
        'miniavs'
      ][i % 6]),
      videoTrack: includeVideo && hasVideo ? createMockVideoTrack() : undefined,
      isVideoOn: hasVideo,
      isHost: isHost,
    });
  }
  
  return participants;
};

/**
 * Generate mock participants with specific scenarios
 */
export const MOCK_SCENARIOS = {
  // Small meeting (2-4 people)
  small: () => generateMockParticipants(3),
  
  // Medium meeting (5-9 people)
  medium: () => generateMockParticipants(7),
  
  // Large meeting (10-16 people)
  large: () => generateMockParticipants(12),
  
  // Webinar (17+ people)
  webinar: () => generateMockParticipants(25),
  
  // All cameras off
  audioOnly: () => generateMockParticipants(6).map(p => ({ ...p, video: false, isVideoOn: false })),
  
  // Mixed state
  mixed: () => {
    const participants = generateMockParticipants(10);
    // First 3 have video on
    participants.forEach((p, i) => {
      if (i < 3) {
        p.video = true;
        p.isVideoOn = true;
      } else {
        p.video = false;
        p.isVideoOn = false;
      }
      // Random audio states
      p.audio = Math.random() > 0.4;
    });
    return participants;
  },
  
  // Everyone muted
  allMuted: () => generateMockParticipants(8).map(p => ({ ...p, audio: false })),
  
  // Single presenter
  presentation: () => {
    const participants = generateMockParticipants(1);
    participants[0].isHost = true;
    participants[0].video = true;
    participants[0].audio = true;
    return participants;
  },
};

// Check if mock mode is enabled
export const isMockModeEnabled = (): boolean => {
  return localStorage.getItem('LOFT_MOCK_MODE') === 'true' || 
         import.meta.env.DEV && window.location.search.includes('mock=true');
};

// Enable/disable mock mode
export const setMockMode = (enabled: boolean) => {
  if (enabled) {
    localStorage.setItem('LOFT_MOCK_MODE', 'true');
  } else {
    localStorage.removeItem('LOFT_MOCK_MODE');
  }
};

// Get mock scenario from URL or localStorage
export const getMockScenario = (): MockParticipant[] => {
  const urlParams = new URLSearchParams(window.location.search);
  const scenario = urlParams.get('mockScenario') || 
                   localStorage.getItem('LOFT_MOCK_SCENARIO') || 
                   'medium';
  
  const scenarioFn = MOCK_SCENARIOS[scenario as keyof typeof MOCK_SCENARIOS];
  return scenarioFn ? scenarioFn() : MOCK_SCENARIOS.medium();
};
