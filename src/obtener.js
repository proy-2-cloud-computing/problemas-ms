const { GetCommand } = require('@aws-sdk/lib-dynamodb');
const c = require('./common');

exports.handler = async (event) => {
  try {
    const { tenant } = c.ctx(event);
    if (!tenant) return c.res(403, { error: 'Token sin tenant_id' });
    const id = c.normId(event.pathParameters?.id);
    if (!id) return c.res(400, { error: 'id invalido' });
    const r = await c.ddb.send(new GetCommand({ TableName: c.TABLE, Key: { tenant_id: tenant, sk: id } }));
    if (!r.Item) return c.res(404, { error: 'No encontrado' }); // otro tenant => 404
    return c.res(200, r.Item);
  } catch (e) {
    console.error(e);
    return c.res(500, { error: 'Error interno' });
  }
};
