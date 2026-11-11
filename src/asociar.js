const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const c = require('./common');

exports.handler = async (event) => {
  try {
    const { tenant } = c.ctx(event);
    if (!tenant) return c.res(403, { error: 'Token sin tenant_id' });
    const id = c.normId(event.pathParameters?.id);
    if (!id) return c.res(400, { error: 'id invalido' });
    const b = c.parseBody(event);
    const nuevos = b && Array.isArray(b.incidentes) ? b.incidentes : null;
    if (!nuevos || !nuevos.length || !nuevos.every((i) => /^INC#\d{6}$/.test(i)))
      return c.res(400, { error: 'incidentes debe ser una lista de IDs INC#NNNNNN' });

    const key = { tenant_id: tenant, sk: id };
    const actual = (await c.ddb.send(new GetCommand({ TableName: c.TABLE, Key: key }))).Item;
    if (!actual) return c.res(404, { error: 'No encontrado' });

    const lista = [...new Set([...(actual.incidentes_relacionados || []), ...nuevos])];
    const r = await c.ddb.send(new UpdateCommand({
      TableName: c.TABLE, Key: key,
      UpdateExpression: 'SET incidentes_relacionados = :l, actualizado_en = :a',
      ExpressionAttributeValues: { ':l': lista, ':a': new Date().toISOString() },
      ConditionExpression: 'attribute_exists(sk)',
      ReturnValues: 'ALL_NEW',
    }));
    return c.res(200, r.Attributes);
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return c.res(404, { error: 'No encontrado' });
    console.error(e);
    return c.res(500, { error: 'Error interno' });
  }
};
