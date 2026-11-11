const { UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const c = require('./common');

exports.handler = async (event) => {
  try {
    const { tenant, sub } = c.ctx(event);
    if (!tenant) return c.res(403, { error: 'Token sin tenant_id' });
    const b = c.parseBody(event);
    if (!b || !b.titulo) return c.res(400, { error: 'titulo es obligatorio' });
    const prioridad = b.prioridad || 'medio';
    if (!c.PRIORIDADES.includes(prioridad)) return c.res(400, { error: 'prioridad invalida' });

    // ID consecutivo atomico por tenant
    const cnt = await c.ddb.send(new UpdateCommand({
      TableName: c.TABLE,
      Key: { tenant_id: tenant, sk: 'CONTADOR#PRB' },
      UpdateExpression: 'ADD valor :uno',
      ExpressionAttributeValues: { ':uno': 1 },
      ReturnValues: 'UPDATED_NEW',
    }));
    const id = `PRB#${String(cnt.Attributes.valor).padStart(6, '0')}`;
    const ahora = new Date().toISOString();

    const item = {
      tenant_id: tenant, sk: id, problema_id: id,
      titulo: b.titulo, descripcion: b.descripcion || '',
      estado: 'identificado', estado_fecha: `identificado#${ahora}`,
      prioridad, causa_raiz: '', workaround: '',
      incidentes_relacionados: Array.isArray(b.incidentes_relacionados) ? b.incidentes_relacionados : [],
      cambio_id: null, responsable: b.responsable || sub,
      creado_en: ahora, actualizado_en: ahora,
    };
    await c.ddb.send(new PutCommand({ TableName: c.TABLE, Item: item }));
    await c.ddb.send(new PutCommand({ TableName: c.TABLE, Item: c.histItem(tenant, id, 'identificado', sub) }));
    await c.publish('problema-creado', tenant, id, 'identificado', sub,
      { incidentes_relacionados: item.incidentes_relacionados });
    return c.res(201, item);
  } catch (e) {
    console.error(e);
    return c.res(500, { error: 'Error interno' });
  }
};
