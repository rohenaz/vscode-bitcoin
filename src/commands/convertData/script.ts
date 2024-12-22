import { js } from '../../utils/css';

export const webviewScript = js`
  (function() {
    const vscode = acquireVsCodeApi();
    const elements = {
      input: document.getElementById('input'),
      fromFormat: document.getElementById('fromFormat'),
      toFormat: document.getElementById('toFormat'),
      output: document.getElementById('output'),
      convertBtn: document.getElementById('convertButton'),
      copyBtn: document.getElementById('copyButton'),
      statusMessage: document.getElementById('statusMessage')
    };

    // Format detection
    function detectFormat(input) {
      if (!input) return;

      // Binary array
      if (/^\\[(\d+,)*\d+\\]$/.test(input)) {
        elements.fromFormat.value = 'binary';
        return;
      }

      // Text with punctuation
      if (
        /[a-zA-Z]/.test(input) &&
        /[a-zA-Z][,!?.\\s]|[,!?.\\s][a-zA-Z]/.test(input) &&
        !/^[0-9A-Fa-f]+$/.test(input) &&
        !/^[A-Za-z0-9+/=]+$/.test(input) &&
        !/^[0-9-]+$/.test(input) &&
        !/^[a-zA-Z]+[0-9]+$/.test(input) &&
        !/^[0-9]+[a-zA-Z]+$/.test(input) &&
        !input.includes('[') &&
        !input.includes(']')
      ) {
        elements.fromFormat.value = 'utf8';
        return;
      }

      // Hex
      if (input.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(input)) {
        elements.fromFormat.value = 'hex';
        return;
      }

      // Base64
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
        elements.fromFormat.value = 'base64';
        return;
      }
    }

    // Conversion handling
    function tryConvert() {
      const { input, fromFormat, toFormat } = elements;
      if (input.value && fromFormat.value && toFormat.value) {
        vscode.postMessage({
          type: 'convert',
          input: input.value,
          fromFormat: fromFormat.value,
          toFormat: toFormat.value
        });
      }
    }

    // Status message handling
    function showStatus(msg) {
      elements.statusMessage.textContent = msg;
      elements.statusMessage.classList.add('visible');
      setTimeout(() => {
        elements.statusMessage.classList.remove('visible');
      }, 2000);
    }

    // Copy handling
    function handleCopy() {
      elements.output.select();
      document.execCommand('copy');
      vscode.postMessage({ type: 'copy' });
      showStatus('Copied to clipboard');
    }

    // Format selection handling
    function selectDifferentFormat(currentFormat) {
      const { toFormat } = elements;
      for (const opt of toFormat.options) {
        if (opt.value !== currentFormat) {
          toFormat.value = opt.value;
          break;
        }
      }
    }

    // Message handling
    function handleMessage(event) {
      const msg = event.data;
      const { input, fromFormat, toFormat, output } = elements;

      switch (msg.type) {
        case 'initialize':
          if (msg.input) {
            input.value = msg.input;
            if (msg.detectedFormat) {
              fromFormat.value = msg.detectedFormat;
              selectDifferentFormat(msg.detectedFormat);
              tryConvert();
            } else {
              detectFormat(msg.input);
              selectDifferentFormat(fromFormat.value);
              tryConvert();
            }
          }
          break;
        case 'result':
          output.value = msg.value;
          showStatus('Conversion succeeded');
          break;
      }
    }

    // Event binding
    function bindEvents() {
      const { input, fromFormat, toFormat, convertBtn, copyBtn } = elements;

      input.addEventListener('paste', (e) => {
        detectFormat(e.clipboardData?.getData('text') || '');
      });

      input.addEventListener('input', () => {
        detectFormat(input.value);
        tryConvert();
      });

      fromFormat.addEventListener('change', tryConvert);
      toFormat.addEventListener('change', tryConvert);
      convertBtn.addEventListener('click', tryConvert);
      copyBtn.addEventListener('click', handleCopy);
      window.addEventListener('message', handleMessage);
    }

    // Initialize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindEvents);
    } else {
      bindEvents();
    }
  })();
`;
