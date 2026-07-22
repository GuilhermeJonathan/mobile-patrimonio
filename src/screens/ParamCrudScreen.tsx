import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal, TextInput,
  StyleSheet, ActivityIndicator, Switch, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { parametrosService, ParamItemDto, MoedaParamDto, SubtipoInvestimentoDto } from '../services/api';
import { numBR } from '../utils/format';
import CotacaoHistoricoScreen from './CotacaoHistoricoScreen';

const ICONES_ATIVO = [
  '🏠','🏢','🚗','⛵','✈️','💰','🏗️','🌿',
  '💎','🖥️','📱','📈','🏭','🚜','🛢️','🛤️',
  '⚽','🌻','🎁','◆',
];

const ICONES_INVESTIMENTO = [
  '📊','🏢','🌍','💰','📦','🔗','🌐','💵',
  '📉','📈','🏳️','💳','⭐','🏆','💡','🔒',
  '⚽','🌈','🚀','◆',
];

// ── Tipos de configuracao ─────────────────────────────────────────────────────

type ParamKind = 'tipoAtivo' | 'tipoInvestimento' | 'moeda';

interface ParamCrudConfig {
  kind: ParamKind;
  titulo: string;
}

export const PARAM_CONFIGS: Record<ParamKind, ParamCrudConfig> = {
  tipoAtivo:        { kind: 'tipoAtivo',        titulo: 'Tipos de Ativo' },
  tipoInvestimento: { kind: 'tipoInvestimento', titulo: 'Tipos de Investimento' },
  moeda:            { kind: 'moeda',            titulo: 'Moedas' },
};

// ── Tela ──────────────────────────────────────────────────────────────────────

interface Props { kind: ParamKind; isAdmin?: boolean; }

type AnyItem = ParamItemDto | MoedaParamDto;

function isMoedaItem(item: AnyItem): item is MoedaParamDto {
  return 'codigo' in item;
}

export default function ParamCrudScreen({ kind, isAdmin = false }: Props) {
  const { colors } = useTheme();
  const config = PARAM_CONFIGS[kind];
  const isMoeda = kind === 'moeda';
  const isTipo  = !isMoeda;

  const [loading,  setLoading]  = useState(false);
  const [items,    setItems]    = useState<AnyItem[]>([]);

  // historico de cotação (navegação in-page)
  const [moedaHistorico, setMoedaHistorico] = useState<MoedaParamDto | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  // modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando,    setEditando]    = useState<AnyItem | null>(null);
  const [fNome,       setFNome]       = useState('');
  const [fCodigo,     setFCodigo]     = useState('');
  const [fOrdem,      setFOrdem]      = useState('');
  const [fAtivo,      setFAtivo]      = useState(true);
  const [fIcone,      setFIcone]      = useState('');
  const [fCotacao,    setFCotacao]    = useState('');
  const [salvando,    setSalvando]    = useState(false);
  const [erroGeral,   setErroGeral]   = useState<string | null>(null);
  const [erroModal,   setErroModal]   = useState<string | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  // Modal de confirmacao de exclusao
  const [confirmItem,   setConfirmItem]   = useState<AnyItem | null>(null);
  const [excluindo,     setExcluindo]     = useState(false);

  // Subtipos (2º nível) — gerenciados dentro da edição de um Tipo de Investimento (admin)
  const [subtipos,   setSubtipos]   = useState<SubtipoInvestimentoDto[]>([]);
  const [subNovo,    setSubNovo]    = useState('');
  const [subBusy,    setSubBusy]    = useState(false);
  const [subCount,   setSubCount]   = useState<Record<number, number>>({}); // qtd de subtipos por tipo (listagem)
  const gerenciaSubtipos = kind === 'tipoInvestimento' && isAdmin && editando != null;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === 'tipoAtivo')        setItems(await parametrosService.tiposAtivo());
      else if (kind === 'tipoInvestimento') {
        setItems(await parametrosService.tiposInvestimento());
        const subs = await parametrosService.subtiposInvestimento().catch(() => []);
        const map: Record<number, number> = {};
        for (const sub of subs) map[sub.tipoInvestimentoId] = (map[sub.tipoInvestimentoId] ?? 0) + 1;
        setSubCount(map);
      }
      else                             setItems(await parametrosService.moedas());
    } catch {
      setErroGeral('Nao foi possivel carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { carregar(); }, [carregar]);

  // Carrega os subtipos do tipo em edição (admin, tipoInvestimento).
  const carregarSubtipos = useCallback(async (tipoId: number) => {
    try {
      const lista = await parametrosService.subtiposInvestimento(tipoId);
      setSubtipos(lista);
      setSubCount(m => ({ ...m, [tipoId]: lista.length }));
    }
    catch { setSubtipos([]); }
  }, []);

  useEffect(() => {
    if (modalAberto && editando && kind === 'tipoInvestimento' && isAdmin) carregarSubtipos(editando.id);
    else setSubtipos([]);
  }, [modalAberto, editando, kind, isAdmin, carregarSubtipos]);

  async function addSubtipo() {
    if (!editando || !subNovo.trim()) return;
    setSubBusy(true);
    try {
      const prox = (subtipos.at(-1)?.ordem ?? 0) + 1;
      await parametrosService.salvarSubtipoInvestimento({ tipoInvestimentoId: editando.id, nome: subNovo.trim(), ordem: prox, ativo: true });
      setSubNovo('');
      await carregarSubtipos(editando.id);
    } catch { setErroModal('Não foi possível adicionar o subtipo.'); }
    finally { setSubBusy(false); }
  }
  async function toggleSubtipo(sub: SubtipoInvestimentoDto) {
    try {
      await parametrosService.salvarSubtipoInvestimento({ id: sub.id, tipoInvestimentoId: sub.tipoInvestimentoId, nome: sub.nome, ordem: sub.ordem, ativo: !sub.ativo });
      if (editando) await carregarSubtipos(editando.id);
    } catch { setErroModal('Não foi possível atualizar o subtipo.'); }
  }
  async function removeSubtipo(sub: SubtipoInvestimentoDto) {
    try {
      await parametrosService.deletarSubtipoInvestimento(sub.id);
      if (editando) await carregarSubtipos(editando.id);
    } catch { setErroModal('Subtipos do sistema não podem ser excluídos (desative-os).'); }
  }

  async function atualizarCotacoes() {
    setAtualizando(true);
    setErroGeral(null);
    setFlashMsg(null);
    try {
      const r = await parametrosService.atualizarCotacoes();
      await carregar();
      setFlashMsg(r.atualizadas > 0
        ? `${r.atualizadas} cotação(ões) atualizada(s).`
        : 'Nenhuma cotação foi atualizada.');
    } catch {
      setErroGeral('Não foi possível atualizar as cotações agora. Tente novamente em instantes.');
    } finally {
      setAtualizando(false);
    }
  }

  // Assessor oculta/reexibe um item GLOBAL (default) do próprio catálogo.
  async function alternarOcultar(item: AnyItem) {
    setErroGeral(null);
    try {
      const oculto = (item as ParamItemDto).oculto;
      if (kind === 'tipoAtivo') {
        oculto ? await parametrosService.reexibirTipoAtivo(item.id) : await parametrosService.ocultarTipoAtivo(item.id);
      } else if (kind === 'tipoInvestimento') {
        oculto ? await parametrosService.reexibirTipoInvestimento(item.id) : await parametrosService.ocultarTipoInvestimento(item.id);
      } else {
        oculto ? await parametrosService.reexibirMoeda(item.id) : await parametrosService.ocultarMoeda(item.id);
      }
      await carregar();
    } catch (e: any) {
      setErroGeral(e?.response?.data?.error ?? 'Não foi possível atualizar o catálogo. Tente novamente.');
    }
  }

  function abrirNovo() {
    setEditando(null);
    setFNome(''); setFCodigo(''); setFOrdem(''); setFAtivo(true); setFIcone(''); setFCotacao('');
    setErroModal(null); setErroValidacao(null);
    setModalAberto(true);
  }

  function abrirEditar(item: AnyItem) {
    setEditando(item);
    setFNome(item.nome);
    setFCodigo(isMoedaItem(item) ? item.codigo : '');
    setFOrdem(String(item.ordem));
    setFAtivo(item.ativo);
    setFIcone(!isMoedaItem(item) ? (item.icone ?? '') : '');
    setFCotacao(isMoedaItem(item) ? String(item.cotacaoBRL) : '');
    setErroModal(null); setErroValidacao(null);
    setModalAberto(true);
  }

  async function salvar() {
    setErroValidacao(null);
    if (!fNome.trim()) { setErroValidacao('Nome e obrigatorio.'); return; }
    if (isMoeda && !fCodigo.trim()) { setErroValidacao('Codigo e obrigatorio.'); return; }
    const ordem = parseInt(fOrdem) || 0;
    setSalvando(true);
    try {
      if (kind === 'tipoAtivo')
        await parametrosService.salvarTipoAtivo({ id: editando?.id, nome: fNome.trim(), ordem, ativo: fAtivo, icone: fIcone || null });
      else if (kind === 'tipoInvestimento')
        await parametrosService.salvarTipoInvestimento({ id: editando?.id, nome: fNome.trim(), ordem, ativo: fAtivo, icone: fIcone || null });
      else {
        const codigo = fCodigo.trim().toUpperCase();
        const cotacaoBRL = codigo === 'BRL' ? 1 : (parseFloat(fCotacao.replace(',', '.')) || 1);
        await parametrosService.salvarMoeda({ id: editando?.id, codigo, nome: fNome.trim(), cotacaoBRL, ordem, ativo: fAtivo });
      }

      setModalAberto(false);
      await carregar();
    } catch (e: any) {
      setErroModal(e?.response?.data?.title ?? 'Nao foi possivel salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item: AnyItem) {
    if (item.isSystem) {
      setErroGeral('Itens do sistema nao podem ser excluidos. Voce pode desativa-los usando "Ativo".');
      return;
    }
    setConfirmItem(item);
  }

  async function confirmarExclusao() {
    if (!confirmItem) return;
    setExcluindo(true);
    try {
      if (kind === 'tipoAtivo')             await parametrosService.deletarTipoAtivo(confirmItem.id);
      else if (kind === 'tipoInvestimento') await parametrosService.deletarTipoInvestimento(confirmItem.id);
      else                                  await parametrosService.deletarMoeda(confirmItem.id);
      setConfirmItem(null);
      await carregar();
    } catch (e: any) {
      setErroGeral(e?.response?.data?.title ?? 'Nao foi possivel excluir.');
      setConfirmItem(null);
    } finally {
      setExcluindo(false);
    }
  }

  // Navegação in-page para histórico de cotação (após todos os hooks)
  if (moedaHistorico) {
    return (
      <CotacaoHistoricoScreen
        moedaCodigo={moedaHistorico.codigo}
        moedaNome={moedaHistorico.nome}
        onVoltar={() => setMoedaHistorico(null)}
      />
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.titulo, { color: colors.text }]}>{config.titulo}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isMoeda && (
            <TouchableOpacity
              style={[s.btnAtualizar, { borderColor: colors.green }, atualizando && { opacity: 0.6 }]}
              onPress={atualizarCotacoes}
              disabled={atualizando}
            >
              {atualizando
                ? <ActivityIndicator size="small" color={colors.green} />
                : <Text style={[s.btnAtualizarTxt, { color: colors.green }]}>↻ Atualizar cotações</Text>}
            </TouchableOpacity>
          )}
          {/* Admin cria itens globais; assessor cria os custom da assessoria dele. */}
          <TouchableOpacity style={[s.btnNovo, { backgroundColor: colors.green }]} onPress={abrirNovo}>
            <Text style={s.btnNovoTxt}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {flashMsg && (
        <View style={[s.erroBar, { backgroundColor: colors.greenDim, borderColor: colors.green }]}>
          <Text style={{ color: colors.green, fontSize: 13 }}>{flashMsg}</Text>
          <TouchableOpacity onPress={() => setFlashMsg(null)}>
            <Text style={{ color: colors.green, fontWeight: '700', marginLeft: 12 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {erroGeral && (
        <View style={[s.erroBar, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}>
          <Text style={{ color: '#ef4444', fontSize: 13 }}>{erroGeral}</Text>
          <TouchableOpacity onPress={() => setErroGeral(null)}>
            <Text style={{ color: '#ef4444', fontWeight: '700', marginLeft: 12 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.lista}
          ListEmptyComponent={
            <Text style={[s.vazio, { color: colors.textSecondary }]}>Nenhum item cadastrado.</Text>
          }
          renderItem={({ item }) => {
            const editavel  = item.podeEditar ?? true;
            const custom    = item.assessorId != null;
            const oculto    = !!item.oculto;
            const ehBRL     = isMoedaItem(item) && item.codigo === 'BRL';
            // Item global visto por um assessor (não-admin): pode ocultar/reexibir, não editar.
            // BRL nunca é ocultável (base de conversão).
            const ocultavel = !isAdmin && !editavel && !custom && !ehBRL;
            return (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }, oculto && { opacity: 0.55 }]}>
              <View style={s.cardLeft}>
                {!isMoeda && !isMoedaItem(item) && item.icone && (
                  <Text style={{ fontSize: 20 }}>{item.icone}</Text>
                )}
                {isMoeda && isMoedaItem(item) && (
                  <Text style={[s.codigo, { color: colors.green }]}>{item.codigo}</Text>
                )}
                <View style={s.nomeRow}>
                  <Text style={[s.nome, { color: colors.text }]}>{item.nome}</Text>
                  {custom && (
                    <View style={[s.badgeSystem, { backgroundColor: colors.greenDim }]}><Text style={[s.badgeSystemTxt, { color: colors.green }]}>meu</Text></View>
                  )}
                  {item.isSystem && (
                    <View style={s.badgeSystem}><Text style={s.badgeSystemTxt}>sistema</Text></View>
                  )}
                  {oculto && (
                    <View style={s.badgeInativo}><Text style={s.badgeInativoTxt}>oculto</Text></View>
                  )}
                  {!item.ativo && (
                    <View style={s.badgeInativo}><Text style={s.badgeInativoTxt}>inativo</Text></View>
                  )}
                  {isMoeda && isMoedaItem(item) && item.codigo !== 'BRL' && item.cotacaoAtualizadaEm && (
                    <Text style={[s.atualizadoEmBadge, { color: colors.textSecondary }]}>
                      🕐 {new Date(item.cotacaoAtualizadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Text style={[s.ordem, { color: colors.textSecondary }]}>
                  {isMoeda && isMoedaItem(item) && item.codigo !== 'BRL'
                    ? `1 ${item.codigo} = R$ ${numBR(item.cotacaoBRL, 4)}`
                    : kind === 'tipoInvestimento'
                      ? `ordem ${item.ordem} · ${subCount[item.id] ?? 0} subtipo(s)`
                      : `ordem ${item.ordem}`}
                </Text>
              </View>

              <View style={s.cardAcoes}>
                {isMoeda && isMoedaItem(item) && item.codigo !== 'BRL' && (
                  <TouchableOpacity style={s.btnAcaoTxt} onPress={() => setMoedaHistorico(item)}>
                    <Text style={{ color: colors.green, fontSize: 13, fontWeight: '600' }}>Histórico</Text>
                  </TouchableOpacity>
                )}
                {editavel && (
                  <TouchableOpacity style={s.btnAcaoTxt} onPress={() => abrirEditar(item)}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Editar</Text>
                  </TouchableOpacity>
                )}
                {editavel && (
                  <TouchableOpacity style={s.btnAcaoTxt} onPress={() => excluir(item)}>
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Excluir</Text>
                  </TouchableOpacity>
                )}
                {ocultavel && (
                  <TouchableOpacity style={s.btnAcaoTxt} onPress={() => alternarOcultar(item)}>
                    <Text style={{ color: oculto ? colors.green : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {oculto ? 'Reexibir' : 'Ocultar'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            );
          }}
        />
      )}

      {/* Página criar / editar — in-page (mantém o menu lateral do AppShell) */}
      {modalAberto && (
        <View style={[s.pageRoot, { backgroundColor: colors.background }]}>
          <View style={[s.pageHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => { setModalAberto(false); setErroModal(null); setErroValidacao(null); }}>
                <Text style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={[s.titulo, { color: colors.text }]}>
                {editando ? 'Editar' : 'Novo'} {
                  kind === 'tipoAtivo' ? 'Tipo de Ativo' :
                  kind === 'tipoInvestimento' ? 'Tipo de Investimento' :
                  'Moeda'
                }
              </Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={s.pageBody} showsVerticalScrollIndicator={false}>

            {isMoeda && (
              <>
                <Text style={[s.label, { color: colors.textSecondary }]}>Codigo (ex: BRL)</Text>
                <TextInput
                  style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={fCodigo}
                  onChangeText={t => setFCodigo(t.toUpperCase())}
                  placeholder="BRL"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  maxLength={10}
                  editable={!editando?.isSystem}
                />
              </>
            )}

            <Text style={[s.label, { color: colors.textSecondary }]}>Nome</Text>
            <TextInput
              style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fNome}
              onChangeText={setFNome}
              placeholder="Nome de exibicao"
              placeholderTextColor={colors.textSecondary}
            />

            {isMoeda && fCodigo.trim().toUpperCase() !== 'BRL' && (
              <>
                <Text style={[s.label, { color: colors.textSecondary }]}>Cotacao em R$ (quanto vale 1 {fCodigo.trim().toUpperCase() || 'unidade'})</Text>
                <TextInput
                  style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={fCotacao}
                  onChangeText={setFCotacao}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 5.40"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}

            {!isMoeda && (
              <>
                <Text style={[s.label, { color: colors.textSecondary }]}>Icone</Text>
                <View style={s.iconeGrid}>
                  {(kind === 'tipoAtivo' ? ICONES_ATIVO : ICONES_INVESTIMENTO).map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={[s.iconeBtn, fIcone === ic && { borderColor: colors.green, backgroundColor: colors.greenDim }]}
                      onPress={() => setFIcone(prev => prev === ic ? '' : ic)}
                    >
                      <Text style={{ fontSize: 22 }}>{ic}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={[s.label, { color: colors.textSecondary }]}>Ordem</Text>
            <TextInput
              style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fOrdem}
              onChangeText={setFOrdem}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={s.switchRow}>
              <Text style={[s.label, { color: colors.textSecondary, marginBottom: 0 }]}>Ativo</Text>
              <Switch
                value={fAtivo}
                onValueChange={setFAtivo}
                trackColor={{ true: colors.green }}
              />
            </View>

            {/* Subtipos deste tipo (2º nível) — só ao editar um Tipo de Investimento (admin) */}
            {gerenciaSubtipos && (
              <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
                <Text style={[s.modalTitulo, { color: colors.text, fontSize: 15, marginBottom: 4 }]}>Subtipos deste tipo</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Ficam disponíveis ao cadastrar um investimento desta classe.</Text>
                {subtipos.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Nenhum subtipo ainda. Adicione abaixo.</Text>
                ) : subtipos.map(sub => (
                  <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ flex: 1, fontSize: 14, color: sub.ativo ? colors.text : colors.textSecondary, textDecorationLine: sub.ativo ? 'none' : 'line-through' }}>
                      {sub.nome} {sub.isSystem && <Text style={{ fontSize: 10, color: colors.textSecondary }}>sistema</Text>}
                    </Text>
                    <TouchableOpacity onPress={() => toggleSubtipo(sub)}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginRight: 14 }}>{sub.ativo ? 'Desativar' : 'Ativar'}</Text>
                    </TouchableOpacity>
                    {!sub.isSystem && (
                      <TouchableOpacity onPress={() => removeSubtipo(sub)}>
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Excluir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TextInput
                    style={[s.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={subNovo} onChangeText={setSubNovo}
                    placeholder="Novo subtipo (ex: IPCA+)" placeholderTextColor={colors.textSecondary} />
                  <TouchableOpacity style={[s.btnSalvar, { backgroundColor: colors.green, flex: 0, flexShrink: 0, minWidth: 130, paddingHorizontal: 20, justifyContent: 'center' }]} onPress={addSubtipo} disabled={subBusy}>
                    {subBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSalvarTxt} numberOfLines={1}>Adicionar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {erroValidacao && (
              <Text style={s.erroInline}>{erroValidacao}</Text>
            )}
          </ScrollView>

          {/* Rodapé fixo com ações */}
          <View style={[s.pageFooter, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            {erroModal && <Text style={[s.erroInline, { marginBottom: 8 }]}>{erroModal}</Text>}
            <View style={s.pageFooterBtns}>
              <TouchableOpacity
                style={[s.btnCancelar, { borderColor: colors.border }]}
                onPress={() => { setModalAberto(false); setErroModal(null); setErroValidacao(null); }}
              >
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSalvar, { backgroundColor: colors.green }]}
                onPress={salvar}
                disabled={salvando}
              >
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarTxt}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal: confirmar exclusao */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>Confirmar exclusao</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 24 }}>
              Deseja excluir "{confirmItem?.nome}"? Esta acao nao pode ser desfeita.
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.btnCancelar, { borderColor: colors.border }]}
                onPress={() => setConfirmItem(null)}
                disabled={excluindo}
              >
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSalvar, { backgroundColor: '#ef4444' }]}
                onPress={confirmarExclusao}
                disabled={excluindo}
              >
                {excluindo
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarTxt}>Excluir</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, paddingTop: 16 },
  erroBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  erroInline:  { color: '#ef4444', fontSize: 13, marginTop: 6 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  titulo:      { fontSize: 22, fontWeight: '700' },
  btnNovo:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnNovoTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnAtualizar:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minWidth: 90, alignItems: 'center' },
  btnAtualizarTxt: { fontWeight: '700', fontSize: 14 },
  lista:       { padding: 16, gap: 10 },
  vazio:       { textAlign: 'center', marginTop: 40, fontSize: 14 },
  card:        { borderRadius: 12, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardLeft:    { flex: 1, gap: 4 },
  codigo:      { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  nomeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nome:        { fontSize: 16, fontWeight: '600' },
  ordem:       { fontSize: 12, marginTop: 2 },
  badgeSystem: { backgroundColor: '#6366f120', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  badgeSystemTxt: { fontSize: 10, color: '#6366f1', fontWeight: '700' },
  badgeInativo:   { backgroundColor: '#ef444420', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  badgeInativoTxt:{ fontSize: 10, color: '#ef4444', fontWeight: '700' },
  cardAcoes:   { flexDirection: 'row', gap: 12, alignItems: 'center' },
  btnAcao:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, borderColor: 'transparent' },
  btnAcaoTxt:  { paddingHorizontal: 4, paddingVertical: 2 },
  atualizadoEm:{ fontSize: 11, marginTop: 2 },
  atualizadoEmBadge: { fontSize: 10, marginLeft: 4, alignSelf: 'center' },
  overlay:     { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:       { width: '100%', maxWidth: 420, borderRadius: 16, padding: 24 },
  pageRoot:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
  pageHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1 },
  pageBody:    { padding: 24, paddingBottom: 40 },
  pageFooter:  { borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  pageFooterBtns: { flexDirection: 'row', gap: 12 },
  modalTitulo: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:       { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input:       { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  switchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  modalBtns:   { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnCancelar: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  btnSalvar:   { flex: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  btnSalvarTxt:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  iconeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  iconeBtn:    { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#33333360', justifyContent: 'center', alignItems: 'center' },
});
