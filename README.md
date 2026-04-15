# IMM-OS OpenMCT 🚀

NASA's [OpenMCT](https://nasa.github.io/openmct/) adapted for the India Moon Mars (IMM) Operating System.

## Overview
Provides a highly customizable web-based mission control interface for telemetry monitoring.
This repo serves a basic Node.js Express app that loads the OpenMCT framework alongside custom IMM plugins.

## Development

```bash
npm install
npm start
```

Access the server at `http://localhost:8080/`.

## Plugins
- `plugins/imm-telemetry-plugin.js`: Custom dictionary and telemetry provider integrating with the IMM-OS backend API.
