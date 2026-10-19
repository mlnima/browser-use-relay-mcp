export const elementDescriptorFields = [
  "id", "tag", "inputType", "contentEditable", "formAssociated", "role", "text", "value",
  "visible", "enabled", "editable", "readonly", "checked", "selected", "selectedValues", "bounds", "outputLimits",
];

export const elementProjectionGuide = `Optional params.fields selects descriptor fields: ${elementDescriptorFields.join(", ")}. Omit fields for the full descriptor; [] returns only id. Optional params.attributes names DOM attributes returned under attributes, with null for missing attributes. Element IDs are always retained. Truncation metadata is retained when values are shortened. Use a small limit and nextOffset for lists; request bounds only when needed.`;
