import QRCode from 'qrcode';

// Helper to calculate CRC16 CCITT (0x1021) as required by Banco Central do Brasil EMV spec
function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function formatTLV(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

function sanitizeText(text: string, maxLen: number): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim();
  return normalized.substring(0, maxLen);
}

export interface PixChargeOptions {
  pixKey: string;
  receiverName: string;
  city: string;
  amount: number | string;
  txId: string;
  description?: string;
}

export interface GeneratedPix {
  pixCode: string;
  qrCodeUrl: string;
  txId: string;
}

/**
 * Generates an authentic EMV BR Code (Pix Copia e Cola) and Base64 Data URL QR Code
 */
export async function generatePixCharge(options: PixChargeOptions): Promise<GeneratedPix> {
  const { pixKey, receiverName, city, amount, txId, description } = options;

  const cleanKey = pixKey.trim();
  const cleanName = sanitizeText(receiverName || 'KOLVOX STAGE', 25) || 'KOLVOX';
  const cleanCity = sanitizeText(city || 'SAO PAULO', 15) || 'SAO PAULO';
  const cleanTxId = (txId.replace(/[^a-zA-Z0-9]/g, '') || 'KOLVOX').substring(0, 25);

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formattedAmount = (isNaN(numAmount) || numAmount <= 0 ? 9.99 : numAmount).toFixed(2);

  // Merchant Account Info (Tag 26)
  const gui = formatTLV('00', 'br.gov.bcb.pix');
  const keyField = formatTLV('01', cleanKey);
  const descField = description ? formatTLV('02', description.substring(0, 40)) : '';
  const merchantAccountInfo = formatTLV('26', `${gui}${keyField}${descField}`);

  // Base payload without CRC
  let payload =
    formatTLV('00', '01') + // Payload Format Indicator
    merchantAccountInfo + // Merchant Account Info
    formatTLV('52', '0000') + // Merchant Category Code
    formatTLV('53', '986') + // Currency: BRL (986)
    formatTLV('54', formattedAmount) + // Transaction Amount
    formatTLV('58', 'BR') + // Country Code
    formatTLV('59', cleanName) + // Merchant Name
    formatTLV('60', cleanCity) + // Merchant City
    formatTLV('62', formatTLV('05', cleanTxId)); // Additional Data (TxID)

  // Append Tag 63 (CRC16)
  payload += '6304';
  const crc = calculateCRC16(payload);
  const pixCode = `${payload}${crc}`;

  // Generate standard QR code with SVG fallback
  let qrCodeUrl = '';
  try {
    qrCodeUrl = await QRCode.toDataURL(pixCode, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch {
    try {
      const svg = await QRCode.toString(pixCode, { type: 'svg', margin: 2 });
      qrCodeUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch {
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(pixCode)}`;
    }
  }

  return {
    pixCode,
    qrCodeUrl,
    txId: cleanTxId,
  };
}
