# Key Learnings

## Function Parameters
- When a function has optional parameters, use the spread operator to conditionally pass them rather than passing undefined
  ```typescript
  // Good
  await func(required, ...(optional ? [optional] : []));
  
  // Bad
  await func(required, optional || undefined);
  ```

## Code Simplification
- Use existing utility functions rather than writing custom logic
- Remove redundant checks and variables
- Keep code DRY (Don't Repeat Yourself)
- Prefer early returns to reduce nesting

## Testing
- Test both success and error cases
- Mock only what's necessary
- Test edge cases (null, undefined, empty input)
- Use descriptive test names that explain the behavior being tested

## Error Handling
- Validate input early
- Provide clear error messages
- Handle edge cases gracefully
- Use type checking to prevent runtime errors

## Type Safety
- Never use the 'any' type
- Use TypeScript's type system to catch errors at compile time
- Define clear interfaces for data structures
- Use type guards to narrow types when necessary

## Command Structure
- Each command should be in its own folder under `src/commands/`
- Command folder structure:
  ```
  src/commands/commandName/
    ├── index.ts         # Command implementation
    └── command.test.ts  # Tests for the command
  ```
- Command implementation should be a single exported function
- Command function should take `outputManager` as first parameter

## Best Practices
- Don't assume, CHECK! You have access to the command line and can look things up
- Keep functions small and focused
- Use clear, descriptive variable names
- Add comments for complex logic, but prefer self-documenting code
- Follow the project's established patterns
