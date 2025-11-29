export const $ = {
  DISCARD: null,
  stringAt: (key: string) => key,
  array: (path: string) => `States.Array(${path})`,
  arrayLength: (path: string) => `States.ArrayLength(${path})`,
  arrayGetItem: (path: string, index: string | number) =>
    `States.ArrayGetItem(${path}, ${index})`,
  format: (format: string, ...args: string[]) =>
    `States.Format('${format}', ${args.join(", ")})`,
  jsonMerge: (
    jsonObject1: object | Array<string | number | object> | string,
    jsonObject2: object | Array<string | number | object> | string
  ) => `States.JsonMerge(${jsonObject1}, ${jsonObject2}, false)`,
  jsonToString: (path: string) => `States.JsonToString(${path})`,
  stringToJson: (path: string) => `States.StringToJson(${path})`,
  mathAdd: (path: string, value: number) => `States.MathAdd(${path}, ${value})`,
  stringSplit: (path: string, splitter: string) =>
    `States.StringSplit(${path}, ${splitter})`,
}

export const $$ = {
  Execution: {
    Id: "$$.Execution.Id",
  },
  Task: {
    Token: "$$.Task.Token",
  },
  Map: {
    Item: {
      Value: "$$.Map.Item.Value",
    },
  },
}
