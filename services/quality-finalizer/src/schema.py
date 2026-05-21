"""Output schema for quality-finalizer step."""

from pydantic import BaseModel


class DownscaleInfo(BaseModel):
    """Metadata describing the quality-finalizer downscale operation.

    Mirrors FinalizerInfo (ffmpeg-finalizer) shape, scoped to the
    supersampling-downscale concern: input/output dimensions, whether the
    Lanczos downscale ran or the input was stream-copied (D-08), the H264
    encode params used (D-09), and the BT.709 color tags carried through
    on the encoded output (D-11).
    """

    input_width: int
    input_height: int
    output_width: int
    output_height: int
    downscale_applied: bool
    h264_crf: int
    h264_preset: str
    lanczos_scaling: bool
    color_space: str
    color_primaries: str
    color_transfer: str
