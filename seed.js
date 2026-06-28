const { db } = require('./db/database');

const products = [
  {
    nombre: "Cordón de cáñamo encerado de 16 colores de 1 mm, cuerda de lino de 4 tarjetas de color, hilo recubierto de cera de 80 yardas, cuerda colorida para joyería Pulsera para hacer artesanías hechas a mano",
    marca: "",
    precio_venta: 50,
    estado: "borrador"
  },
  {
    nombre: "Mini Removedor de Pelo para Mascotas | Removedor de Pelo para Perros para Alfombras de Coches y Suministros de Limpieza de Coches, Removedor de Pelo para Gatos para Muebles, Cepillo de Alfombra Reutilizable y Eliminación de Pelusa",
    marca: "",
    precio_venta: 40,
    estado: "borrador"
  },
  {
    nombre: "Valuu Lazy Glasses Bed Prism Glasses Spectacles Horizontal High Definition Glasses Prism Periscope Lie Down Eyeglasses for Reading and Watch TV in Bed",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Valuu Lazy Glasses Bed Prism Glasses Spectacles Horizontal High Definition Glasses Prism Periscope Lie Down Eyeglasses for Reading and Watch TV in Bed",
    marca: "",
    precio_venta: 90,
    estado: "borrador"
  },
  {
    nombre: "HintSparkling Water, Tangerine - Bebidas de agua con sabor a lata con electrolitos, cero calorías y sin azúcar - 12 latas de 12 onzas líquidas (pack de 12)",
    marca: "",
    precio_venta: 90,
    estado: "borrador"
  },
  {
    nombre: "AMOSJOYCat Sill Window Perch Asiento de ventana de hamaca resistente con funda de cama de cojín, marco de madera y metal para gatos grandes, cama de gato fácil de ajustar para ventanas",
    marca: "",
    precio_venta: 200,
    estado: "borrador"
  },
  {
    nombre: "Copa atlética protectora suave para béisbol, fútbol, lacrosse, hockey, artes marciales mixtas, protector de ingle para niños y adultos 6 piezas marca sratte",
    marca: "Sratte",
    precio_venta: 60,
    estado: "borrador"
  },
  {
    nombre: "Ventilador de escape de 8 pulgadas, 686CFM Ventiladores de ventilación montados en la pared, Ventilador de ventilación para el ventilador de ventilación del sótano del ático del baño del techo, 110V 80W",
    marca: "",
    precio_venta: 100,
    estado: "borrador"
  },
  {
    nombre: "Lightning to HDMI Cable Adapter for iPhone to TV/Projector/Monitor, Plug & Play 1080P@60Hz HD Screen Mirroring, Portable HDMI Extender",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Mini Plug in Heater, Portable Wall Space Heater with Remote, Small Wall Outlet Heating with Adjustable Thermostat and 12H Timer, LED Display for Home calentador portable",
    marca: "Mitlink",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "lámpara de mesa para dormitorio, mesita de noche, lámpara de dormitorio con puerto USB C touch",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Dados giratorios de ruleta mecánica, dados giratorios de metal 7 en 1, lobos, para juegos de rol RPG",
    marca: "",
    precio_venta: 100,
    estado: "borrador"
  },
  {
    nombre: "Cepillos de Dientes Mini Desechables con Pasta de Dientes y Palillos, Limpiadores de Lengua, Reducen el Mal Aliento, Raspador de Lengua, Cepillo de Dientes Prepastado, Ideal para Trabajo",
    marca: "",
    precio_venta: 70,
    estado: "borrador"
  },
  {
    nombre: "Extensor de Enchufe Eléctrico OEM, Enchufe de Pared Universal para EE. UU., Extensión de Enchufe de Corriente 4 marca lencent",
    marca: "Lencent",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Amplificador de Señal WiFi Repetidor Inalámbrico 300M Repetidor WiFi Alance WiFi marca anfoal",
    marca: "",
    precio_venta: 50,
    estado: "borrador"
  },
  {
    nombre: "Kit limpiador de botellas de viaje 6 en 1: esencial de viaje para bebés, juego de cepillos para biberones con cepillo de silicona para botellas, cepillo para pajilla, cepillo para pezones, dispensador marca babies and mons green",
    marca: "",
    precio_venta: 70,
    estado: "borrador"
  },
  {
    nombre: "Water Flosser for Teeth Cleaning: Cordless Portable Water Dental Pick, 4 Modes Rechargeable Oral Irrigator with 5 Nozzles, 300ML IPX7 Waterproof Elect Irrigador Oral Limpieza Dental Profunda Recargable One Pixel Inalámbrico Recargable IPX7",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Carteras tipo cuero estilo europeo, virales y juveniles color purple",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Carteras tipo cuero estilo europeo, virales y juveniles color purple",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Carteras tipo cuero estilo europeo, virales y juveniles color purple",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Carteras tipo cuero estilo europeo, virales y juveniles",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Herramienta de limpieza de parabrisas marca xindelll",
    marca: "",
    precio_venta: 60,
    estado: "borrador"
  },
  {
    nombre: "Kit De Sellado Al Vacío Eléctrico Para Tarros Mason",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Kit De Sellado Al Vacío Eléctrico Para Tarros Mason",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Kit de Reparación de Rosca de bujía Set Automotive Threading Tools",
    marca: "",
    precio_venta: 200,
    estado: "borrador"
  },
  {
    nombre: "Adaptador para autos electricos, NACS to CCS Adapter, Tesla Supercharger 250KW, 500A / 1000V, NACS DC Adapter for CCS1 Electric Vehicles, Compatible with Volvo, Polestar, Ford, Kia, H",
    marca: "",
    precio_venta: 300,
    estado: "borrador"
  },
  {
    nombre: "Modelones Juego de esmaltes de uñas en gel camaleón, 6 colores, con purpurina verde, rosa, azul, morado, holográfico, secado rápido, mini kit de laca de uñas, gris, aurora, brillo, arte de uñas",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Didog Collar de cuero acolchado suave para perros medianos, collar de perro clásico con cierre rápido de metal, ajustable, tamaño mediano, piel sintética, verde",
    marca: "",
    precio_venta: 35,
    estado: "borrador"
  },
  {
    nombre: "Cojín de asiento de gel 2 en 1, comodidad personalizada de larga duración, estructura de gel transpirable, funda de malla lavable extraíble, rejilla ergonómica de gel de panal",
    marca: "",
    precio_venta: 100,
    estado: "borrador"
  },
  {
    nombre: "Organizador de plastico grande",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Disfraz Kpop para Niñas, Conjunto de Cosplay de Guerrera K-pop naranja para 6 años",
    marca: "",
    precio_venta: 120,
    estado: "borrador"
  },
  {
    nombre: "Westmore Beauty Cepillo Kabuki para mezclar y difuminar el cuerpo y cepillo autobronceador - Para maquillaje corporal y base - Aplicador de mezcla para autobronceado",
    marca: "",
    precio_venta: 35,
    estado: "borrador"
  },
  {
    nombre: "Favoto - Funda impermeable para motocicleta, universal, duradera",
    marca: "",
    precio_venta: 200,
    estado: "borrador"
  },
  {
    nombre: "Soporte para Brochas de Maquillaje con Tapa, Organizador de Brochas de Maquillaje Giratorio de 360°, Soportes para Brochas de Maquillaje para Tocador, Organizador(Base blanca con tapa transparente.)",
    marca: "",
    precio_venta: 80,
    estado: "borrador"
  },
  {
    nombre: "Clips de cocodrilo con cable de prueba de cable/6 unidades",
    marca: "",
    precio_venta: 40,
    estado: "borrador"
  }
];

function seed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM productos').get().c;
  if (count > 0) {
    console.log(`Base de datos ya tiene ${count} productos, saltando seed.`);
    return;
  }

  console.log('Creando productos iniciales...');
  const insert = db.prepare(`
    INSERT INTO productos (nombre, marca, precio_venta, estado, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item.nombre, item.marca, item.precio_venta, item.estado);
    }
  });

  insertMany(products);
  console.log(`${products.length} productos creados exitosamente.`);
}

module.exports = { seed };

if (require.main === module) {
  seed();
  console.log('Seed completado.');
}
