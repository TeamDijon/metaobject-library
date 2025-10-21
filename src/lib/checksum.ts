import crypto from 'crypto';

/**
 * Calculate SHA-256 checksum for a string
 * @param content - The content to checksum
 * @returns Checksum in format "sha256:hexdigest"
 */
export function calculateChecksum(content: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Verify a checksum against content
 * @param content - The content to verify
 * @param expectedChecksum - Expected checksum in format "sha256:hexdigest"
 * @returns True if checksums match
 */
export function verifyChecksum(content: string, expectedChecksum: string): boolean {
  const actualChecksum = calculateChecksum(content);
  return actualChecksum === expectedChecksum;
}
