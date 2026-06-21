export interface SoundbyteProfile {
  id: string;
  name: string;
  level: string;
  pprProblem: string;
  pprProduct: string;
  pprResult: string;
  holeWeOwn: string;
  coreSoundbyte: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoundbyteAudience {
  id: string;
  soundbyteId: string;
  label: string;
  personaDescription: string;
  keyPainPoints: string;
  keyDesiredResults: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIPersona {
  id: string;
  name: string;
  role: string;
  description: string;
  defaultModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIKnowledgePack {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
