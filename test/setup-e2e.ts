import * as crypto from 'crypto';

// Mock uuid module for e2e tests - generates real random UUIDs
jest.mock('uuid', () => ({
  v4: jest.fn(() => crypto.randomUUID()),
}));
