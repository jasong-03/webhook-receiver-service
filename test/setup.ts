// Mock uuid module for tests
// Using a valid UUID v4 format (4 in position 13, 8/9/a/b in position 17)
jest.mock('uuid', () => ({
  v4: jest.fn(() => '123e4567-e89b-4123-a456-426614174000'),
}));
