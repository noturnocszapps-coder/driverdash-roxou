export class AIService {
  private static apiProvider: 'mock' | 'gemini' | 'openai' | 'claude' = 'mock';

  public static setProvider(provider: 'mock' | 'gemini' | 'openai' | 'claude') {
    this.apiProvider = provider;
  }

  /**
   * Universal completion wrapper for future LLM hookups
   */
  public static async generateCompletion(prompt: string, context?: any): Promise<string> {
    if (this.apiProvider === 'gemini') {
      // Future hookup:
      // const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      // return response.text;
    }
    
    // Default analytical local generation
    return `[AI Abstraction Output] Analisando contexto: ${JSON.stringify(context || {})}. Sugestão: ${prompt.slice(0, 100)}`;
  }
}
