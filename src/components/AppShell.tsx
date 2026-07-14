import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions,
  Modal, Pressable, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRouter, Rota } from '../navigation/router';
import { useAssessoria } from '../contexts/AssessoriaContext';

interface MenuItem {
  id: Rota;
  label: string;
  icon: string;
  emBreve?: boolean;
  assessorOnly?: boolean;
  clienteData?: boolean;
  clienteOnly?: boolean;
}

interface MenuGroup {
  id: 'cadastros-group' | 'gp-group';
  label: string;
  icon: string;
  assessorOnly?: boolean;
  clienteOnly?: boolean;
  children: MenuItem[];
}

type MenuEntry = MenuItem | MenuGroup;

function isGroup(e: MenuEntry): e is MenuGroup {
  return (e as MenuGroup).children !== undefined;
}

const CADASTROS_ROTAS: Rota[] = [
  'cadastros-tipos-ativo',
  'cadastros-tipos-investimento',
  'cadastros-moedas',
];

const GP_ROTAS: Rota[] = [
  'gp-dashboard', 'gp-lancamentos', 'gp-categorias',
  'gp-dividas', 'gp-assinaturas', 'gp-metas', 'gp-cartoes',
];

const MENU: MenuEntry[] = [
  { id: 'home',          label: 'Inicio',        icon: '🏠' },
  { id: 'clientes',      label: 'Clientes',      icon: '👥', assessorOnly: true },
  {
    id: 'cadastros-group', label: 'Cadastros', icon: '⚙️', assessorOnly: true,
    children: [
      { id: 'cadastros-tipos-ativo',        label: 'Tipos de Ativo',        icon: '🏷️' },
      { id: 'cadastros-tipos-investimento', label: 'Tipos de Investimento', icon: '📈' },
      { id: 'cadastros-moedas',             label: 'Moedas',                icon: '💱' },
    ],
  },
  {
    id: 'gp-group', label: 'Gestao Pessoal', icon: '💼', clienteOnly: true,
    children: [
      { id: 'gp-dashboard',   label: 'Dashboard',   icon: '📊' },
      { id: 'gp-lancamentos', label: 'Lancamentos', icon: '💸' },
      { id: 'gp-categorias',  label: 'Categorias',  icon: '🏷️' },
      { id: 'gp-cartoes',     label: 'Cartoes',     icon: '💳' },
      { id: 'gp-dividas',     label: 'Dividas',     icon: '📋' },
      { id: 'gp-assinaturas', label: 'Assinaturas', icon: '🔄' },
      { id: 'gp-metas',       label: 'Metas',       icon: '🎯' },
    ],
  },
  { id: 'patrimonio',    label: 'Patrimonio',    icon: '📊', clienteData: true },
  { id: 'ativos',        label: 'Ativos',        icon: '🏛️', clienteData: true },
  { id: 'investimentos', label: 'Investimentos', icon: '💹', clienteData: true },
  { id: 'relatorios',    label: 'Relatorios',    icon: '📄', emBreve: true },
];

function AvatarCircle({ avatarUrl, iniciais, size, fontSize, bgColor }: {
  avatarUrl?: string | null; iniciais: string; size: number; fontSize: number; bgColor: string;
}) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize }}>{iniciais}</Text>
    </View>
  );
}

interface AppShellProps {
  onLogout: () => void;
  isAssessor: boolean;
  userName?: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}

export default function AppShell({ onLogout, isAssessor, userName, avatarUrl, children }: AppShellProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { rota, navigate } = useRouter();
  const { cliente, sair } = useAssessoria();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const s = makeStyles(colors);

  const [drawerAberto,  setDrawerAberto]  = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(() => CADASTROS_ROTAS.includes(rota));
  const [gpOpen,        setGpOpen]        = useState(() => GP_ROTAS.includes(rota));

  const emViewAs     = !!cliente?.clienteId;
  const assessorPuro = isAssessor && !emViewAs;
  const iniciais     = (userName ?? '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  const contaActive  = rota === 'conta';

  function visivel(entry: MenuEntry): boolean {
    if (entry.assessorOnly && !isAssessor) return false;
    if (entry.assessorOnly && emViewAs)    return false;
    if (entry.clienteOnly  && assessorPuro) return false;
    if (!isGroup(entry) && entry.clienteData && assessorPuro) return false;
    return true;
  }

  return (
    <View style={s.root}>
      <View style={[s.sidebar, !isDesktop && s.sidebarMobile]}>
        <View style={s.brand}>
          <Text style={s.brandIcon}>💎</Text>
          {isDesktop && <Text style={s.brandText}>Patrimonio</Text>}
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {MENU.filter(visivel).map(entry => {
            if (isGroup(entry)) {
              const anyChildActive = entry.children.some(c => c.id === rota);
              const isOpen  = entry.id === 'gp-group' ? gpOpen : cadastrosOpen;
              const toggleOpen = entry.id === 'gp-group'
                ? () => setGpOpen(o => !o)
                : () => setCadastrosOpen(o => !o);
              return (
                <View key={entry.id}>
                  <TouchableOpacity
                    style={[s.item, anyChildActive && s.itemActive]}
                    onPress={toggleOpen}
                  >
                    <Text style={s.itemIcon}>{entry.icon}</Text>
                    {isDesktop && (
                      <>
                        <Text style={[s.itemLabel, anyChildActive && s.itemLabelActive]}>{entry.label}</Text>
                        <Text style={[s.chevron, { color: anyChildActive ? colors.green : colors.textSecondary }]}>
                          {isOpen ? '▾' : '▸'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {isOpen && isDesktop && entry.children.map(child => {
                    const active = rota === child.id;
                    return (
                      <TouchableOpacity
                        key={child.id}
                        style={[s.subItem, active && s.subItemActive]}
                        onPress={() => navigate(child.id)}
                      >
                        <View style={s.subItemLine} />
                        <Text style={s.itemIcon}>{child.icon}</Text>
                        <Text style={[s.subItemLabel, active && s.itemLabelActive]}>{child.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {isOpen && !isDesktop && entry.children.map(child => {
                    const active = rota === child.id;
                    return (
                      <TouchableOpacity key={child.id} style={[s.item, active && s.itemActive]} onPress={() => navigate(child.id)}>
                        <Text style={[s.itemIcon, { fontSize: 15 }]}>{child.icon}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            }
            const active = rota === entry.id;
            return (
              <TouchableOpacity key={entry.id} style={[s.item, active && s.itemActive]} onPress={() => navigate(entry.id)}>
                <Text style={s.itemIcon}>{entry.icon}</Text>
                {isDesktop && (
                  <>
                    <Text style={[s.itemLabel, active && s.itemLabelActive]}>{entry.label}</Text>
                    {entry.emBreve && <Text style={s.emBreve}>em breve</Text>}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.contaDivider} />
        <TouchableOpacity style={[s.contaBtn, contaActive && s.itemActive]} onPress={() => navigate('conta')}>
          <AvatarCircle avatarUrl={avatarUrl} iniciais={iniciais} size={32} fontSize={12} bgColor={colors.green} />
          {isDesktop && (
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.contaNome, contaActive && { color: colors.green }]} numberOfLines={1}>{userName ?? 'Minha Conta'}</Text>
              <Text style={s.contaSub}>Perfil e Configuracoes</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {emViewAs && (
          <View style={s.viewAsBanner}>
            <Text style={s.viewAsBannerText} numberOfLines={1}>
              Visualizando como <Text style={s.viewAsBannerNome}>{cliente!.nome}</Text>
            </Text>
            <TouchableOpacity style={s.viewAsBannerBtn} onPress={() => { sair(); navigate('clientes'); }}>
              <Text style={s.viewAsBannerBtnText}>Sair da visao</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.topbar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s.topBtn} onPress={() => navigate('ativos')}>
            <Text style={s.topBtnIcon}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDrawerAberto(true)}>
            <AvatarCircle avatarUrl={avatarUrl} iniciais={iniciais} size={36} fontSize={14} bgColor={colors.green} />
          </TouchableOpacity>
        </View>

        {children}
      </View>

      <Modal visible={drawerAberto} transparent animationType="fade" onRequestClose={() => setDrawerAberto(false)}>
        <Pressable style={s.overlay} onPress={() => setDrawerAberto(false)}>
          <Pressable style={s.drawer}>
            <View style={s.drawerHeader}>
              <AvatarCircle avatarUrl={avatarUrl} iniciais={iniciais} size={56} fontSize={20} bgColor={colors.green} />
              <Text style={s.drawerNome} numberOfLines={1}>{userName ?? '-'}</Text>
              <Text style={s.drawerSub}>Perfil e Configuracoes</Text>
            </View>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} onPress={() => { setDrawerAberto(false); navigate('conta'); }}>
              <Text style={s.drawerItemIcon}>👤</Text>
              <Text style={s.drawerItemText}>Minha conta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerItem} onPress={toggleTheme}>
              <Text style={s.drawerItemIcon}>{isDark ? '🌙' : '☀️'}</Text>
              <Text style={s.drawerItemText}>{isDark ? 'Tema escuro' : 'Tema claro'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} onPress={() => { setDrawerAberto(false); onLogout(); }}>
              <Text style={s.drawerItemIcon}>🚪</Text>
              <Text style={s.drawerSairText}>Sair da conta</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:            { flex: 1, flexDirection: 'row', backgroundColor: c.background },
  sidebar:         { width: 220, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.border, paddingVertical: 20, paddingHorizontal: 12 },
  sidebarMobile:   { width: 64, paddingHorizontal: 8, alignItems: 'center' },
  brand:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28, paddingHorizontal: 8 },
  brandIcon:       { color: c.green, fontSize: 22, fontWeight: '800' },
  brandText:       { color: c.text, fontSize: 18, fontWeight: '800' },
  item:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4 },
  itemActive:      { backgroundColor: c.greenDim },
  itemIcon:        { fontSize: 18, width: 22, textAlign: 'center' },
  itemLabel:       { color: c.textSecondary, fontSize: 15, fontWeight: '600', flex: 1 },
  itemLabelActive: { color: c.green },
  emBreve:         { color: c.textTertiary, fontSize: 10, fontStyle: 'italic' },
  chevron:         { fontSize: 13, marginLeft: 4 },
  subItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, paddingLeft: 18, borderRadius: 10, marginBottom: 2 },
  subItemActive:   { backgroundColor: c.greenDim },
  subItemLine:     { width: 2, height: 18, backgroundColor: c.border, borderRadius: 2, marginRight: 4 },
  subItemLabel:    { color: c.textSecondary, fontSize: 14, fontWeight: '500', flex: 1 },
  contaDivider:    { height: 1, backgroundColor: c.border, marginVertical: 10, marginHorizontal: 4 },
  contaBtn:        { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 10 },
  contaNome:       { color: c.text, fontSize: 14, fontWeight: '700' },
  contaSub:        { color: c.textSecondary, fontSize: 11, marginTop: 1 },
  viewAsBanner:        { backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  viewAsBannerText:    { color: '#ede9fe', fontSize: 14, fontWeight: '600', flex: 1 },
  viewAsBannerNome:    { color: '#fff', fontWeight: '800' },
  viewAsBannerBtn:     { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16 },
  viewAsBannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  topbar:    { height: 54, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  topBtn:    { width: 38, height: 38, borderRadius: 10, backgroundColor: c.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  topBtnIcon:{ fontSize: 17 },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer:         { position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, backgroundColor: c.surface, borderLeftWidth: 1, borderLeftColor: c.border, paddingTop: 28, paddingBottom: 20 },
  drawerHeader:   { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  drawerNome:     { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 12 },
  drawerSub:      { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  drawerDivider:  { height: 1, backgroundColor: c.border },
  drawerItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 20 },
  drawerItemIcon: { fontSize: 19, width: 24, textAlign: 'center' },
  drawerItemText: { color: c.text, fontSize: 15, fontWeight: '600' },
  drawerSairText: { color: c.red, fontSize: 15, fontWeight: '700' },
});