export interface PipelineManifest {
  step_name: string;
  input_file: string;
  output_files: string[];
  duration_seconds: number;
  timestamp: string;
  status: "success" | "error";
  error_message?: string;
  exit_code: number;
}

export function createSuccessManifest(params: {
  step_name: string;
  input_file: string;
  output_files: string[];
  duration_seconds: number;
}): PipelineManifest {
  return {
    step_name: params.step_name,
    input_file: params.input_file,
    output_files: params.output_files,
    duration_seconds: params.duration_seconds,
    timestamp: new Date().toISOString(),
    status: "success",
    exit_code: 0,
  };
}

export function createErrorManifest(params: {
  step_name: string;
  input_file: string;
  exit_code: number;
  error_message: string;
  duration_seconds: number;
}): PipelineManifest {
  return {
    step_name: params.step_name,
    input_file: params.input_file,
    output_files: [],
    duration_seconds: params.duration_seconds,
    timestamp: new Date().toISOString(),
    status: "error",
    exit_code: params.exit_code,
    error_message: params.error_message,
  };
}