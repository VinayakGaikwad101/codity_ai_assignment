import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/error.middleware.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';

export interface AiFailureSummary {
  rootCause: string;
  category: 'NETWORK_TIMEOUT' | 'DOWNSTREAM_OUTAGE' | 'AUTHENTICATION_ERROR' | 'SCHEMA_VALIDATION' | 'RESOURCE_EXHAUSTION' | 'APPLICATION_ERROR' | 'UNKNOWN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
  recommendations: string[];
}

export class AiSummaryService {
  static async generateFailureSummary(dlqId: string, organizationId: string): Promise<AiFailureSummary> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      throw new AppError(
        'No AI API Key provided. Please configure GEMINI_API_KEY in your .env environment to generate AI failure summaries.',
        400,
        'MISSING_AI_API_KEY'
      );
    }

    const entry = await prisma.deadLetterQueueEntry.findUnique({
      where: { id: dlqId },
      include: {
        job: true,
        project: true,
      },
    });

    if (!entry || entry.project.organizationId !== organizationId) {
      throw new AppError('Quarantined DLQ entry not found', 404, 'DLQ_NOT_FOUND');
    }

    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

      // Initialize LangChain Google Generative AI model
      const model = new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: apiKey.trim(),
        temperature: 0.2,
      });

      const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert site reliability engineer and backend distributed systems architect.
Analyze the following background job failure that has exhausted all retries and landed in the Dead Letter Queue.

Job Name: {jobName}
Handler Type: {handlerType}
Total Retries Attempted: {totalAttempts}
Failure Reason: {failureReason}
Exception Stack Trace:
{stackTrace}
Original Input Payload:
{originalPayload}

Respond with a strictly valid JSON object matching this TypeScript interface without any markdown formatting or surrounding backticks:
{{
  "rootCause": "string (concise title, e.g. Downstream Payment Gateway Outage)",
  "category": "NETWORK_TIMEOUT" | "DOWNSTREAM_OUTAGE" | "AUTHENTICATION_ERROR" | "SCHEMA_VALIDATION" | "RESOURCE_EXHAUSTION" | "APPLICATION_ERROR" | "UNKNOWN",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "explanation": "string (2-3 sentences explaining the root cause and why it failed)",
  "recommendations": ["string", "string", "string"] (3 actionable steps the engineer should take before replaying)
}}
`);

      const formattedPrompt = await promptTemplate.format({
        jobName: entry.job.name,
        handlerType: entry.job.handlerType,
        totalAttempts: entry.totalAttempts.toString(),
        failureReason: entry.failureReason || 'Unknown error',
        stackTrace: entry.stackTrace || entry.failureReason || 'None',
        originalPayload: JSON.stringify(entry.originalPayload || {}),
      });

      const response = await model.invoke(formattedPrompt);
      const rawContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // Clean markdown code fence if returned
      const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed: AiFailureSummary = JSON.parse(cleaned);

      return parsed;
    } catch (err: any) {
      console.error('[LangChain Gemini Diagnosis Error]:', err);
      // Fallback heuristic if external network or rate limit fails
      return {
        rootCause: `Exception Analysis: ${entry.failureReason.substring(0, 80)}`,
        category: 'APPLICATION_ERROR',
        severity: 'HIGH',
        explanation: `Job failed repeatedly after ${entry.totalAttempts} attempts. An unhandled exception was thrown during handler execution (${entry.failureReason}).`,
        recommendations: [
          'Inspect the raw stack trace in the error drawer below.',
          `Review recent worker code changes to handler: ${entry.job.handlerType}.`,
          'Test the handler locally with identical payload parameters before replaying.',
        ],
      };
    }
  }
}
