import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions,
  Modal, Pressable, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy } from '../theme/PrivacyContext';
import { useRouter, Rota } from '../navigation/router';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { assessoriaService, RecomendacaoDto, RespostaRecomendacaoDto } from '../services/api';

interface MenuItem {
  id: Rota;
  label: string;
  icon: string;
  emBreve?: boolean;
  assessorOnly?: boolean;
  clienteData?: boolean;
  clienteOnly?: boolean;
  viewAsOnly?: boolean;   // só aparece quando o assessor está visualizando um cliente
  corretorOnly?: boolean; // só aparece para o corretor
}

interface MenuGroup {
  id: 'cadastros-group' | 'gp-group';
  label: string;
  icon: string;
  assessorOnly?: boolean;
  clienteOnly?: boolean;
  clienteData?: boolean;  // dados do cliente — visíveis também no view-as (assessor/corretor)
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
  'cadastros-consultoria',
];

const GP_ROTAS: Rota[] = [
  'gp-dashboard', 'gp-lancamentos', 'gp-categorias',
  'gp-dividas', 'gp-assinaturas', 'gp-cartoes',
];

const MENU: MenuEntry[] = [
  { id: 'home',          label: 'Início',        icon: '🏠' },
  { id: 'clientes',      label: 'Clientes',      icon: '👥', assessorOnly: true },
  { id: 'recomendacoes', label: 'Recomendações', icon: '💬', assessorOnly: true },
  { id: 'planos',        label: 'Planos de Ação', icon: '🧭', assessorOnly: true },
  { id: 'corretores',    label: 'Corretores',    icon: '\uD83E\uDD1D', assessorOnly: true, corretorOnly: true },
  {
    id: 'cadastros-group', label: 'Cadastros', icon: '⚙️', assessorOnly: true,
    children: [
      { id: 'cadastros-tipos-ativo',        label: 'Tipos de Ativo',        icon: '🏷️' },
      { id: 'cadastros-tipos-investimento', label: 'Tipos de Investimento', icon: '📈' },
      { id: 'cadastros-moedas',             label: 'Moedas',                icon: '💱' },
      { id: 'cadastros-consultoria',        label: 'Minha Consultoria',     icon: '🏢' },
    ],
  },
  {
    id: 'gp-group', label: 'Gestão Pessoal', icon: '💼', clienteOnly: true, clienteData: true,
    children: [
      { id: 'gp-dashboard',   label: 'Dashboard',   icon: '📊' },
      { id: 'gp-lancamentos', label: 'Lançamentos', icon: '💸' },
      { id: 'gp-categorias',  label: 'Categorias',  icon: '🏷️' },
      { id: 'gp-cartoes',     label: 'Cartões',     icon: '💳' },
      { id: 'gp-dividas',     label: 'Parcelados',  icon: '🧾' },
      { id: 'gp-assinaturas', label: 'Assinaturas', icon: '🔄' },
    ],
  },
  { id: 'gp-metas',       label: 'Metas',       icon: '🎯', clienteOnly: true, clienteData: true },
  { id: 'patrimonio',    label: 'Patrimônio',    icon: '📊', clienteData: true },
  { id: 'ativos',        label: 'Ativos',        icon: '🏛️', clienteData: true },
  { id: 'passivos',      label: 'Dívidas',       icon: '📉', clienteData: true },
  { id: 'investimentos', label: 'Investimentos', icon: '💹', clienteData: true },
  { id: 'projecao',      label: 'Projeção',      icon: '🔮', clienteData: true },
  { id: 'plano-acao',    label: 'Plano de Ação', icon: '🧭', clienteData: true },
  { id: 'relatorios',    label: 'Relatórios',    icon: '📄', viewAsOnly: true },
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
  isCorretor?: boolean;
  userName?: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}

export default function AppShell({ onLogout, isAssessor, isCorretor = false, userName, avatarUrl, children }: AppShellProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { ocultar, toggle: toggleOcultar } = usePrivacy();
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
  const ehCliente    = !isAssessor && !isCorretor; // cliente puro recebe recomendações

  // Recomendações pendentes do cliente → sino de notificação na topbar
  const [recsPendentes, setRecsPendentes] = useState<RecomendacaoDto[]>([]);
  const [sinoAberto, setSinoAberto]       = useState(false);
  const recPendentes = recsPendentes.length;
  const temAlerta    = recsPendentes.some(r => r.tipo === 3);
  useEffect(() => {
    if (!ehCliente) { setRecsPendentes([]); return; }
    let vivo = true;
    assessoriaService.minhasRecomendacoes()
      .then(lista => { if (vivo) setRecsPendentes(lista.filter(r => r.status === 1)); })
      .catch(() => { /* silencia */ });
    return () => { vivo = false; };
  }, [ehCliente, rota]);

  function abrirRecomendacao(recId: string) {
    setSinoAberto(false);
    navigate('home', `rec:${recId}`);
  }

  // Sino do assessor: respostas dos clientes às recomendações
  const ehAssessor = isAssessor && !emViewAs;
  const [respostas, setRespostas]     = useState<RespostaRecomendacaoDto[]>([]);
  const [respNaoVistas, setRespNaoVistas] = useState(0);
  useEffect(() => {
    if (!ehAssessor) { setRespostas([]); setRespNaoVistas(0); return; }
    let vivo = true;
    assessoriaService.respostasRecomendacoes()
      .then(r => { if (vivo) { setRespostas(r.itens); setRespNaoVistas(r.naoVistas); } })
      .catch(() => { /* silencia */ });
    return () => { vivo = false; };
  }, [ehAssessor, rota]);

  async function abrirSinoAssessor() {
    setSinoAberto(true);
    if (respNaoVistas > 0) {
      setRespNaoVistas(0);
      try { await assessoriaService.marcarRespostasVistas(); } catch { /* silencia */ }
    }
  }
  const iniciais     = (userName ?? '?').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  const contaActive  = rota === 'conta';

  function visivel(entry: MenuEntry): boolean {
    // Corretor
    if (isCorretor) {
      // Visualizando cliente delegado → mostra os dados do cliente (patrimônio, ativos, Gestão Pessoal, etc.)
      if (emViewAs) return entry.id === 'home' || !!entry.clienteData || (!isGroup(entry) && !!(entry as MenuItem).viewAsOnly);
      // Corretor puro → só home + corretores (grupos não aparecem)
      if (isGroup(entry)) return false;
      return entry.id === 'home' || !!(entry as MenuItem).corretorOnly;
    }
    if (entry.assessorOnly && !isAssessor) return false;
    if (entry.assessorOnly && emViewAs)    return false;
    if (entry.clienteOnly  && assessorPuro) return false;
    if (!isGroup(entry) && entry.clienteData && assessorPuro) return false;
    if (!isGroup(entry) && entry.viewAsOnly && !emViewAs) return false;
    return true;
  }

  // Renderiza o menu com rótulos (usado no sidebar do desktop e no drawer do mobile).
  const renderMenu = (closeAfter: boolean) => {
    const go = (id: Rota) => { navigate(id); if (closeAfter) setDrawerAberto(false); };
    return MENU.filter(visivel).map(entry => {
      if (isGroup(entry)) {
        const anyChildActive = entry.children.some(c => c.id === rota);
        const isOpen = entry.id === 'gp-group' ? gpOpen : cadastrosOpen;
        const toggleOpen = entry.id === 'gp-group' ? () => setGpOpen(o => !o) : () => setCadastrosOpen(o => !o);
        return (
          <View key={entry.id}>
            <TouchableOpacity style={[s.item, anyChildActive && s.itemActive]} onPress={toggleOpen}>
              <Text style={s.itemIcon}>{entry.icon}</Text>
              <Text style={[s.itemLabel, anyChildActive && s.itemLabelActive]}>{entry.label}</Text>
              <Text style={[s.chevron, { color: anyChildActive ? colors.green : colors.textSecondary }]}>{isOpen ? '▾' : '▸'}</Text>
            </TouchableOpacity>
            {isOpen && entry.children.map(child => {
              const active = rota === child.id;
              return (
                <TouchableOpacity key={child.id} style={[s.subItem, active && s.subItemActive]} onPress={() => go(child.id)}>
                  <View style={s.subItemLine} />
                  <Text style={s.itemIcon}>{child.icon}</Text>
                  <Text style={[s.subItemLabel, active && s.itemLabelActive]}>{child.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      const active = rota === entry.id;
      return (
        <TouchableOpacity key={entry.id} style={[s.item, active && s.itemActive]} onPress={() => go(entry.id)}>
          <Text style={s.itemIcon}>{entry.icon}</Text>
          <Text style={[s.itemLabel, active && s.itemLabelActive]}>{entry.label}</Text>
          {entry.emBreve && <Text style={s.emBreve}>em breve</Text>}
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={s.root}>
      {isDesktop && (
      <View style={s.sidebar}>
        <View style={s.brand}>
          <Text style={s.brandIcon}>💎</Text>
          <Text style={s.brandText}>Patrimônio</Text>
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
              <Text style={s.contaSub}>Perfil e Configurações</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      )}

      <View style={{ flex: 1 }}>
        {emViewAs && (
          <View style={s.viewAsBanner}>
            <Text style={s.viewAsBannerText} numberOfLines={1}>
              Editando como <Text style={s.viewAsBannerNome}>{cliente!.nome}</Text> · alterações vão para o cliente
            </Text>
            <TouchableOpacity style={s.viewAsBannerBtn} onPress={() => { sair(); navigate('clientes'); }}>
              <Text style={s.viewAsBannerBtnText}>Sair da visao</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.topbar}>
          {!isDesktop && (
            <TouchableOpacity style={s.hamburger} onPress={() => setDrawerAberto(true)} accessibilityLabel="Menu">
              <Text style={s.hamburgerIcon}>☰</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {ehCliente && (
            <TouchableOpacity style={s.sino} onPress={() => setSinoAberto(true)} accessibilityLabel="Notificações">
              <Text style={s.sinoIcon}>{temAlerta ? '🚨' : '🔔'}</Text>
              {recPendentes > 0 && (
                <View style={[s.sinoBadge, temAlerta && s.sinoBadgeAlerta]}>
                  <Text style={s.sinoBadgeTxt}>{recPendentes > 9 ? '9+' : recPendentes}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {ehAssessor && (
            <TouchableOpacity style={s.sino} onPress={abrirSinoAssessor} accessibilityLabel="Notificações">
              <Text style={s.sinoIcon}>🔔</Text>
              {respNaoVistas > 0 && (
                <View style={s.sinoBadge}>
                  <Text style={s.sinoBadgeTxt}>{respNaoVistas > 9 ? '9+' : respNaoVistas}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.ocultarPill, ocultar && s.ocultarPillOn]} onPress={toggleOcultar}>
            <Text style={[s.ocultarTxt, ocultar && { color: colors.green }]}>
              {ocultar ? '🙈 Valores ocultos' : '👁 Ocultar valores'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDrawerAberto(true)}>
            <AvatarCircle avatarUrl={avatarUrl} iniciais={iniciais} size={36} fontSize={14} bgColor={colors.green} />
          </TouchableOpacity>
        </View>

        {children}
      </View>

      <Modal visible={sinoAberto} transparent animationType="fade" onRequestClose={() => setSinoAberto(false)}>
        <Pressable style={s.overlay} onPress={() => setSinoAberto(false)}>
          <Pressable style={s.sinoDropdown}>
            <View style={s.sinoDropHeader}>
              <Text style={s.sinoDropTitulo}>Notificações</Text>
            </View>
            {ehAssessor ? (
              respostas.length === 0 ? (
                <Text style={s.sinoVazio}>Nenhuma resposta dos clientes ainda.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 360 }}>
                  {respostas.map(r => {
                    const aceita = r.status === 2;
                    return (
                      <TouchableOpacity key={r.id} style={s.sinoItem} onPress={() => { setSinoAberto(false); navigate('recomendacoes'); }}>
                        <Text style={s.sinoItemIcon}>{aceita ? '✅' : '❌'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.sinoItemTipo, { color: aceita ? colors.green : colors.red }]}>
                            {r.nomeCliente} {aceita ? 'aceitou' : 'recusou'} sua recomendação
                          </Text>
                          <Text style={s.sinoItemTexto} numberOfLines={2}>{r.respostaCliente || r.texto}</Text>
                        </View>
                        <Text style={s.sinoItemSeta}>›</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )
            ) : recPendentes === 0 ? (
              <Text style={s.sinoVazio}>Nenhuma recomendação pendente.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {recsPendentes.map(r => {
                  const icone = r.tipo === 1 ? '📋' : r.tipo === 3 ? '🚨' : '💡';
                  const label = r.tipo === 1 ? 'Ajuste de orçamento' : r.tipo === 3 ? 'Alerta' : 'Dica';
                  return (
                    <TouchableOpacity key={r.id} style={s.sinoItem} onPress={() => abrirRecomendacao(r.id)}>
                      <Text style={s.sinoItemIcon}>{icone}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.sinoItemTipo, r.tipo === 3 && { color: colors.red }]}>{label}</Text>
                        <Text style={s.sinoItemTexto} numberOfLines={2}>{r.texto}</Text>
                      </View>
                      <Text style={s.sinoItemSeta}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={drawerAberto} transparent animationType="fade" onRequestClose={() => setDrawerAberto(false)}>
        <Pressable style={s.overlay} onPress={() => setDrawerAberto(false)}>
          <Pressable style={s.drawer}>
            <View style={s.drawerHeader}>
              <AvatarCircle avatarUrl={avatarUrl} iniciais={iniciais} size={56} fontSize={20} bgColor={colors.green} />
              <Text style={s.drawerNome} numberOfLines={1}>{userName ?? '-'}</Text>
              <Text style={s.drawerSub}>Perfil e Configurações</Text>
            </View>
            <View style={s.drawerDivider} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
              {renderMenu(true)}
            </ScrollView>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} onPress={() => { setDrawerAberto(false); navigate('conta'); }}>
              <Text style={s.drawerItemIcon}>👤</Text>
              <Text style={s.drawerItemText}>Minha conta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.drawerItem} onPress={toggleTheme}>
              <Text style={s.drawerItemIcon}>{isDark ? '🌙' : '☀️'}</Text>
              <Text style={s.drawerItemText}>{isDark ? 'Tema escuro' : 'Tema claro'}</Text>
            </TouchableOpacity>
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
  hamburger: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  hamburgerIcon: { color: c.text, fontSize: 18, fontWeight: '800' },
  topBtn:    { width: 38, height: 38, borderRadius: 10, backgroundColor: c.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  topBtnIcon:{ fontSize: 17 },
  sino:          { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceElevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.border },
  sinoIcon:      { fontSize: 18 },
  sinoBadge:     { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.orange ?? '#f59e0b', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: c.surface },
  sinoBadgeAlerta:{ backgroundColor: c.red ?? '#ef4444' },
  sinoBadgeTxt:  { color: '#fff', fontSize: 10, fontWeight: '800' },
  ocultarPill:   { backgroundColor: c.surfaceElevated, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  ocultarPillOn: { borderColor: c.greenBorder, backgroundColor: c.greenDim },
  ocultarTxt:    { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sinoDropdown:   { position: 'absolute', top: 60, right: 16, width: 340, maxWidth: '92%', backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  sinoDropHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  sinoDropTitulo: { color: c.text, fontSize: 15, fontWeight: '800' },
  sinoDropSub:    { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  sinoVazio:      { color: c.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 22, paddingHorizontal: 16 },
  sinoItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  sinoItemIcon:   { fontSize: 18 },
  sinoItemTipo:   { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  sinoItemTexto:  { color: c.textSecondary, fontSize: 12, lineHeight: 16 },
  sinoItemSeta:   { color: c.textTertiary, fontSize: 20, fontWeight: '700' },
  drawer:         { position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, maxWidth: '82%', backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.border, paddingTop: 28, paddingBottom: 20 },
  drawerHeader:   { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  drawerNome:     { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 12 },
  drawerSub:      { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  drawerDivider:  { height: 1, backgroundColor: c.border },
  drawerItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 20 },
  drawerItemIcon: { fontSize: 19, width: 24, textAlign: 'center' },
  drawerItemText: { color: c.text, fontSize: 15, fontWeight: '600' },
  drawerSairText: { color: c.red, fontSize: 15, fontWeight: '700' },
});