import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  MindMapProject: a
    .model({
      name: a.string().required(),
      displayOrder: a.integer(),
    })
    .authorization((allow) => [allow.owner()]),

  MindMapNode: a
    .model({
      projectId: a.id().required(),
      parentId: a.id(),
      label: a.string().required(),
      x: a.float().required(),
      y: a.float().required(),
      color: a.string(),
    })
    .secondaryIndexes((index) => [
      index("projectId").queryField("listByProject"),
    ])
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
