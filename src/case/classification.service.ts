import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InferenceClient } from '@huggingface/inference';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import type { ClassificationVerdict } from './types/int.type';

// ---- configuration ----------------------------------------------------

// Secrets come from the environment. With either missing the classifier is
// disabled: cases are still created and stored, they just stay `pending`.
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN ?? '';

// Accepts EITHER form:
//
//   1. A Hub repo id — "owner/model-name", exactly as it appears in the URL
//      https://huggingface.co/owner/model-name. The SDK then selects an
//      inference provider on its own (provider defaults to "auto").
//
//   2. A dedicated Inference Endpoint URL — "https://xxxx.endpoints.huggingface.cloud".
//      A custom fine-tune is often not served by any serverless provider, in
//      which case auto-routing cannot find it and a dedicated endpoint is the
//      answer. Detected here by the leading protocol.
// STOPGAP. garbnet-uganda-trash has no weights pushed and no inference
// provider, and no waste-specific model on the Hub is currently served by any
// provider. This is a general ImageNet-1k classifier that IS served, used as a
// proxy: it recognises the objects that make up litter rather than litter
// itself. Swap this one line back to the real model once it is deployed.
const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL ?? 'https://garbnet-uganda-trash.endpoints.huggingface.cloud';

// A top label containing one of these (case-insensitive) means "waste present".
//
// The first group are the words a purpose-built waste model would emit. The
// second are ImageNet-1k class names for objects that dominate street litter —
// needed only while the stopgap model above is in use, and safe to delete with
// it. ImageNet labels are comma-separated synonym lists, e.g.
// "ashcan, trash can, garbage can, wastebin, dustbin", so substring matching
// works well on them.
const WASTE_LABEL_HINTS = [
  // a real waste classifier's vocabulary
  'waste', 'litter', 'trash', 'garbage', 'rubbish', 'dirty', 'polluted',
  // ImageNet proxies for street litter
  'ashcan', 'dustbin', 'plastic bag', 'packet', 'carton', 'bottle',
  'beer can', 'pop bottle', 'water bottle', 'paper towel', 'toilet tissue',
  'crate', 'barrel', 'bucket', 'tray', 'envelope',
];

const INFERENCE_TIMEOUT_MS = 30_000;
const INFERENCE_MAX_ATTEMPTS = 3;
const INFERENCE_RETRY_DELAY_MS = 4_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A Hub *page* URL is not an inference endpoint. Pasting the address bar from
// huggingface.co is the obvious mistake, so it is converted to the repo id
// rather than POSTed at, which would just hit an HTML page.
const HUB_PAGE_URL = /^https?:\/\/(?:www\.)?huggingface\.co\/([^/\s?#]+\/[^/\s?#]+)/i;

function resolveModelTarget(value: string): { dedicated: boolean; target: string } {
  const hubPage = value.match(HUB_PAGE_URL);
  if (hubPage) {
    return { dedicated: false, target: hubPage[1] };
  }
  // Anything else with a protocol is a real endpoint (…endpoints.huggingface.cloud).
  if (/^https?:\/\//i.test(value)) {
    return { dedicated: true, target: value };
  }
  return { dedicated: false, target: value };
}

// ---- service ----------------------------------------------------------

// Lives in the case module rather than a module of its own: the only caller is
// CaseService, and keeping it here means no cross-module wiring at all.
//
// It deliberately does NOT touch the database. It answers one question — is
// there waste in this image — and CaseService decides what that means for the
// case. That keeps persistence in one place and makes this trivially testable.
@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);
  private readonly client = HUGGINGFACE_TOKEN ? new InferenceClient(HUGGINGFACE_TOKEN) : null;

  isEnabled(): boolean {
    return HUGGINGFACE_TOKEN.length > 0 && HUGGINGFACE_MODEL.length > 0;
  }

  async classifyImage(imagePath: string): Promise<ClassificationVerdict> {
    const image = await this.readImage(imagePath);
    const predictions = await this.infer(image);

    if (predictions.length === 0) {
      throw new ServiceUnavailableException('The model returned no predictions');
    }

    // Highest score wins. The model is binary, so this is the verdict.
    const [top] = [...predictions].sort((a, b) => b.score - a.score);
    const label = String(top.label ?? '');
    const wastePresent = this.readsAsWaste(label);

    this.logger.log(
      `'${label}' ${(Number(top.score) * 100).toFixed(1)}% -> ${wastePresent ? 'waste' : 'no waste'} ` +
        `(all labels: ${predictions.map((p) => `${p.label}=${Number(p.score).toFixed(2)}`).join(', ')})`,
    );

    return { label, score: Number(top.score ?? 0), wastePresent };
  }

  private readsAsWaste(label: string): boolean {
    const normalised = label.toLowerCase();
    return WASTE_LABEL_HINTS.some((hint) => normalised.includes(hint));
  }

  private async readImage(imagePath: string): Promise<Blob> {
    // imagePath is stored relative to the project root, e.g. uploads/cases/x.png
    const absolute = join(process.cwd(), imagePath);
    const bytes = await readFile(absolute);
    const type = MIME_BY_EXTENSION[extname(absolute).toLowerCase()] ?? 'application/octet-stream';
    return new Blob([bytes], { type });
  }

  private async infer(data: Blob): Promise<Array<{ label: string; score: number }>> {
    const { dedicated, target } = resolveModelTarget(HUGGINGFACE_MODEL);
    let lastError: any;

    for (let attempt = 1; attempt <= INFERENCE_MAX_ATTEMPTS; attempt++) {
      try {
        const options = { signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS) };

        // A dedicated endpoint already knows its model, so none is sent.
        const result = dedicated
          ? await this.client!.endpoint(target).imageClassification({ data }, options)
          : await this.client!.imageClassification({ data, model: target }, options);

        return result as Array<{ label: string; score: number }>;
      } catch (error: any) {
        lastError = error;
        const message = String(error?.message ?? '');

        // A cold model answers 503 "loading" — normal, and worth waiting out.
        // Anything else is a real failure and retrying only delays the report.
        const worthRetrying = /loading|503|timed out|timeout|ETIMEDOUT|fetch failed/i.test(message);
        if (!worthRetrying || attempt === INFERENCE_MAX_ATTEMPTS) {
          break;
        }

        this.logger.warn(`Inference attempt ${attempt} failed (${message}); retrying`);
        await sleep(INFERENCE_RETRY_DELAY_MS);
      }
    }

    throw new ServiceUnavailableException(
      `Inference failed for '${target}': ${lastError?.message ?? 'unknown error'}`,
    );
  }
}
