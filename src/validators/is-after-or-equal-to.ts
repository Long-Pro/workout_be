import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsAfterOrEqualTo(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfterOrEqualTo',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: {
        message: `"${propertyName}" must be later than or equal to "${property}"`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];
          if (!(value instanceof Date) || !(relatedValue instanceof Date)) {
            return false;
          }
          return value >= relatedValue;
        },
      },
    });
  };
}
