import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

export const stylizeImage = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string,
  apiKey: string
): Promise<string> => {
  try {
    if (!apiKey) {
      throw new Error('Missing Google Gemini API key. Please add it in Settings.');
    }
    const ai = new GoogleGenAI({ apiKey });
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    // Find the image part in the response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart && imagePart.inlineData) {
      return imagePart.inlineData.data;
    } else {
      // Check for safety ratings or other reasons for blockage
      const safetyRatings = response.candidates?.[0]?.safetyRatings;
      if (safetyRatings?.some(rating => rating.probability !== 'NEGLIGIBLE')) {
        throw new Error('Image generation was blocked due to safety concerns. Please try a different image or prompt.');
      }
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
         throw new Error(`Image generation failed. Reason: ${finishReason}. Please try again.`);
      }
      throw new Error("The AI did not return an image. Please try a different theme or upload another picture.");
    }
  } catch (error: any) {
    console.error('Gemini API call failed:', error);
    // Re-throw a more user-friendly error
    throw new Error(error.message || 'An unexpected error occurred while contacting the AI service.');
  }
};
