export interface CreativeIdea {
  titulo: string;
  formato: "estatico" | "carrossel" | "reel";
  gancho: string;
  prompt_completo: string;
  inspiracao: string;
}

export interface CreativeIdeasResponse {
  ideias: CreativeIdea[];
  baseadoEm: {
    totalPosts: number;
    formatosAnalisados: string[];
    janelaDias: number;
    modeloUsado: string;
  };
}
