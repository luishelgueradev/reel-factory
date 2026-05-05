# Shared Pipeline Constants

This directory contains constants and type definitions shared across all pipeline containers.
Containers mount the same Docker volume at `/data/pipeline` and use these path conventions
to locate input/output files consistently.