const { GetCommand, UpdateCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const c = require('./common');

const CAMPOS = ['titulo', 'descripcion', 'prioridad', 'causa_raiz', 'workaround',
                'cambio_id', 'responsable', 'estado'];

exports.handler = async (event) => {
  try {
    const { tenant, sub } = c.ctx(event);
    if (!tenant) return c.res(403, { error: 'Token sin tenant_id' });
    const id = c.normId(event.pathParameters?.id);
    if (!id) return c.res(400, { error: 'id invalido' });
    const b = c.parseBody(event);
    if (!b) return c.res(400, { error: 'JSON invalido' });
    if (b.estado && !c.ESTADOS.includes(b.estado)) return c.res(400, { error: 'estado invalido' });
    if (b.prioridad && !c.PRIORIDADES.includes(b.prioridad)) return c.res(400, { error: 'prioridad invalida' });

    const key = { tenant_id: tenant, sk: id };
    const actual = (await c.ddb.send(new GetCommand({ TableName: c.TABLE, Key: key }))).Item;
    if (!actual) return c.res(404, { error: 'No encontrado' });

    const sets = ['actualizado_en = :ahora'];
    const vals = { ':ahora': new Date().toISOString() };
    const names = {};
    for (const f of CAMPOS) {
      if (b[f] !== undefined) { sets.push(`#${f} = :${f}`); names[`#${f}`] = f; vals[`:${f}`] = b[f]; }
    }
    if (b.estado) { sets.push('estado_fecha = :ef'); vals[':ef'] = `${b.estado}#${actual.creado_en}`; }

    const r = await c.ddb.send(new UpdateCommand({
      TableName: c.TABLE, Key: key,
      UpdateExpression: 'SET ' + sets.join(', '),
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: vals,
      ConditionExpression: 'attribute_exists(sk)',
      ReturnValues: 'ALL_NEW',
    }));

    if (b.estado && b.estado !== actual.estado) {
      await c.ddb.send(new PutCommand({ TableName: c.TABLE,
        Item: c.histItem(tenant, id, b.estado, sub, { estado_anterior: actual.estado }) }));
      if (b.estado === 'resuelto') {
        await c.publish('problema-resuelto', tenant, id, 'resuelto', sub,
          { incidentes_relacionados: r.Attributes.incidentes_relacionados || [] });
      }
    }
    return c.res(200, r.Attributes);
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return c.res(404, { error: 'No encontrado' });
    console.error(e);
    return c.res(500, { error: 'Error interno' });
  }
};
