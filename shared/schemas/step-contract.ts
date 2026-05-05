export const STEP_ENV_VARS = {
  INPUT_PATH: "INPUT_PATH",
  OUTPUT_PATH: "OUTPUT_PATH",
  PIPELINE_JOB_ID: "PIPELINE_JOB_ID",
} as const;

export interface StepContract {
  stepName: string;
  inputPath: string;
  outputPath: string;
  jobId: string;
}

export function parseStepContract(stepName: string): StepContract {
  const inputPath = process.env[STEP_ENV_VARS.INPUT_PATH];
  const outputPath = process.env[STEP_ENV_VARS.OUTPUT_PATH];
  const jobId = process.env[STEP_ENV_VARS.PIPELINE_JOB_ID];

  if (!inputPath) {
    throw new Error(`Missing required env var: ${STEP_ENV_VARS.INPUT_PATH}`);
  }
  if (!outputPath) {
    throw new Error(`Missing required env var: ${STEP_ENV_VARS.OUTPUT_PATH}`);
  }
  if (!jobId) {
    throw new Error(`Missing required env var: ${STEP_ENV_VARS.PIPELINE_JOB_ID}`);
  }

  return { stepName, inputPath, outputPath, jobId };
}