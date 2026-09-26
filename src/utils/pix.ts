import QRCode from 'qrcode';

// CRC-16 CCITT polynomial for Brazilian PIX
function computeCrc16(payload: string): string {
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

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatEmvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function generatePixPayload(params: {
  pixKey: string;
  receiverName: string;
  city: string;
  amount?: string;
  referenceCode?: string;
}): string {
  const { pixKey, receiverName, city, amount, referenceCode } = params;

  // Clean strings
  const cleanKey = pixKey.trim();
  const cleanName = receiverName.trim().substring(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const cleanCity = city.trim().substring(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const cleanRef = (referenceCode || 'KVX').trim().substring(0, 25).replace(/[^a-zA-Z0-9]/g, '');

  // 00 - Payload Format Indicator
  let payload = formatEmvField('00', '01');

  // 01 - Point of Initiation Method: 12 (dynamic / reuse)
  payload += formatEmvField('01', '12');

  // 26 - Merchant Account Info
  const gui = formatEmvField('00', 'br.gov.bcb.pix');
  const keyField = formatEmvField('01', cleanKey);
  payload += formatEmvField('26', `${gui}${keyField}`);

  // 52 - Merchant Category Code
  payload += formatEmvField('52', '0000');

  // 53 - Transaction Currency (986 = BRL)
  payload += formatEmvField('53', '986');

  // 54 - Transaction Amount (optional or formatted like 10.00)
  if (amount && parseFloat(amount) > 0) {
    const formattedAmount = parseFloat(amount).toFixed(2);
    payload += formatEmvField('54', formattedAmount);
  }

  // 58 - Country Code (BR)
  payload += formatEmvField('58', 'BR');

  // 59 - Merchant Name
  payload += formatEmvField('59', cleanName || 'KOLVOX STAGE');

  // 60 - Merchant City
  payload += formatEmvField('60', cleanCity || 'SAO PAULO');

  // 62 - Additional Data Field Template (TxID)
  const txIdField = formatEmvField('05', cleanRef || '***');
  payload += formatEmvField('62', txIdField);

  // 63 - CRC16 (Calculated over payload + "6304")
  const payloadToHash = `${payload}6304`;
  const crc = computeCrc16(payloadToHash);

  return `${payloadToHash}${crc}`;
}

export async function generatePixQrDataUrl(pixPayload: string): Promise<string> {
  try {
    return await QRCode.toDataURL(pixPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Error generating PIX QR Code:', err);
    return '';
  }
}
