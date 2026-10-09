import type {
  Contact,
  Equipment,
  Livret,
  Recommendation,
  Transport,
} from "@/generated/prisma/client";
import { asLocalized, type Localized } from "@/lib/localized";

/** Versions « sérialisables » (JSON bilingues normalisés) partagées serveur → client. */

export function toLivretForm(l: Livret) {
  return {
    name: l.name,
    title: l.title,
    address: l.address,
    city: l.city,
    latitude: l.latitude,
    longitude: l.longitude,
    active: l.active,
    coverImageId: l.coverImageId,
    checkinTime: l.checkinTime,
    buildingCode: l.buildingCode,
    buildingInstructions: asLocalized(l.buildingInstructions),
    accessType: l.accessType,
    keyboxCode: l.keyboxCode,
    keyInstructions: asLocalized(l.keyInstructions),
    facadeImageIds: l.facadeImageIds,
    videoUrl: l.videoUrl,
    welcomeMessage: asLocalized(l.welcomeMessage),
    parking: asLocalized(l.parking),
    wifiSsid: l.wifiSsid,
    wifiPassword: l.wifiPassword,
    rules: asLocalized(l.rules),
    essentials: asLocalized(l.essentials),
    checkoutTime: l.checkoutTime,
    checkoutInstructions: asLocalized(l.checkoutInstructions),
    contactName: l.contactName,
    contactSubtitle: l.contactSubtitle,
    contactPhone: l.contactPhone,
    contactEmail: l.contactEmail,
    footerText: l.footerText,
  };
}
export type LivretForm = ReturnType<typeof toLivretForm>;

export function toRecoItem(r: Recommendation) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    address: r.address,
    description: asLocalized(r.description),
    imageId: r.imageId,
    phone: r.phone,
    website: r.website,
    travelTime: r.travelTime,
    travelMode: r.travelMode,
  };
}
export function toEquipmentItem(e: Equipment) {
  return {
    id: e.id,
    name: asLocalized(e.name),
    category: e.category,
    icon: e.icon,
    instructions: asLocalized(e.instructions),
    imageId: e.imageId,
    tip: asLocalized(e.tip),
    tipType: e.tipType,
  };
}
export function toTransportItem(t: Transport) {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    line: t.line,
    color: t.color,
    detail: asLocalized(t.detail),
    phone: t.phone,
    address: t.address,
    url: t.url,
  };
}
export function toContactItem(c: Contact) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    phone: c.phone,
    address: c.address,
    detail: asLocalized(c.detail),
  };
}

export type RecoItem = ReturnType<typeof toRecoItem>;
export type EquipmentItem = ReturnType<typeof toEquipmentItem>;
export type TransportItem = ReturnType<typeof toTransportItem>;
export type ContactItem = ReturnType<typeof toContactItem>;
export type { Localized };
