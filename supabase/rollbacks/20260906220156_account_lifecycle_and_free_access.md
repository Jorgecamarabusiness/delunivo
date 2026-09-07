# Reversión compatible del ciclo de cuentas y accesos

Esta migración es aditiva, pero no se debe ejecutar un `DROP` de sus columnas o
colas: eliminaría concesiones gratuitas, recibos históricos y solicitudes en curso.
No existe un rollback destructivo automático.

Si falla el código nuevo, desplegar una corrección que conserve los helpers de
cuenta activa y el procesador de solicitudes. Ocultar temporalmente el inicio de
nuevas solicitudes, manteniendo su consulta/reintento y la cola persistente. Los
accesos ya concedidos y los pagos históricos se conservan. No devolver una cuenta
`deleting` a `active` ni recrear una identidad borrada para resolver una incidencia.

Antes de aplicar: copia privada y restauración aislada verificadas, CI SQL/Auth/RLS,
revisión independiente, migración primero y código Production después. Validar
los grants y el login inmediatamente tras la migración. El cliente anterior puede
leer las tablas ampliadas, pero no debe reutilizarse su conciliador de pagos para
cuentas en eliminación. Las solicitudes nuevas solo se habilitan con el código nuevo.
