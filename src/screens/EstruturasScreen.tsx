import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert, PanResponder,
} from 'react-native';
import Svg, { Rect, Text as SvgText, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import {
  estruturasService, GrafoEstruturasDto, EstruturaDto, EstruturaInput, EstruturaDetalheDto,
} from '../services/api';
import { numBR } from '../utils/format';
import { confirmar } from '../utils/confirm';
import DonutChart, { DonutSlice } from '../components/charts/DonutChart';

const GOLD = '#C79A4E';
const PALETA_DIST = ['#C79A4E', '#6C8EBF', '#B784D6', '#4E9A7E', '#D6795B', '#9AA5B1', '#C7574E', '#4E7EC7'];

const TIPOS: { v: number; label: string }[] = [
  { v: 1, label: 'Trust' }, { v: 2, label: 'Holding Patrimonial' }, { v: 3, label: 'Holding de Participações' },
  { v: 4, label: 'Offshore' }, { v: 5, label: 'Empresa Operacional' }, { v: 6, label: 'PPLI' }, { v: 99, label: 'Outro' },
];
const TIPO_LABEL: Record<number, string> = Object.fromEntries(TIPOS.map(t => [t.v, t.label]));
const RELACOES = [{ v: 1, label: 'Propriedade direta' }, { v: 2, label: 'Benefício de trust' }];
const PAPEIS = [{ v: 1, label: 'Cônjuge' }, { v: 2, label: 'Filho' }, { v: 3, label: 'Neto' }, { v: 99, label: 'Outro' }];
const PAPEL_LABEL: Record<number, string> = Object.fromEntries(PAPEIS.map(p => [p.v, p.label]));
const MOEDAS = ['BRL', 'USD', 'EUR', 'CHF', 'GBP'];

function fmtData(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtBRL(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${numBR(v / 1_000_000, 2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${numBR(v / 1_000, 1)}k`;
  return `R$ ${numBR(v, 0)}`;
}

const VAZIO: EstruturaInput = { nome: '', tipo: 2, jurisdicao: '', observacoes: '' };

export default function EstruturasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [dados, setDados] = useState<GrafoEstruturasDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // modal estrutura
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EstruturaInput>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // modal participação
  const [modalPart, setModalPart] = useState(false);
  const [pPai, setPPai] = useState<string | null>(null); // null = família
  const [pFilha, setPFilha] = useState<string>('');
  const [pPct, setPPct] = useState('100');
  const [pRel, setPRel] = useState(1);
  const [salvandoPart, setSalvandoPart] = useState(false);
  const [erroPart, setErroPart] = useState<string | null>(null);

  // drill-down (detalhe da estrutura)
  const [detalhe, setDetalhe] = useState<EstruturaDetalheDto | null>(null);
  const [carregandoDet, setCarregandoDet] = useState(false);

  // mapa: só zoom (o arraste do fundo fica travado; quem arrasta são as caixas)
  const [zoom, setZoom] = useState(1);
  const resetMapa = () => setZoom(1);
  const [fullscreen, setFullscreen] = useState(false);
  // posições manuais dos nós (drag ao vivo). Persistidas no release.
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const onDragMove = (id: string, x: number, y: number) => setPosOverrides(o => ({ ...o, [id]: { x, y } }));
  const onDragEnd = (id: string, x: number, y: number) => {
    setPosOverrides(o => ({ ...o, [id]: { x, y } }));
    estruturasService.salvarPosicao(id, Math.round(x), Math.round(y)).catch(() => { /* mantém local */ });
  };

  const load = useCallback(async () => {
    try {
      setErro(null);
      setDados(await estruturasService.grafo());
    } catch {
      setErro('Não foi possível carregar as estruturas.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  function novaEstrutura() { setEditId(null); setForm(VAZIO); setErroForm(null); setModal(true); }
  function editar(e: EstruturaDto) {
    setEditId(e.id);
    setForm({ nome: e.nome, tipo: e.tipo, jurisdicao: e.jurisdicao ?? '', observacoes: e.observacoes ?? '' });
    setErroForm(null); setModal(true);
  }
  async function salvar() {
    if (!form.nome.trim()) { setErroForm('Informe o nome.'); return; }
    setSalvando(true); setErroForm(null);
    try {
      const payload = { ...form, jurisdicao: form.jurisdicao?.trim() || null, observacoes: form.observacoes?.trim() || null };
      if (editId) await estruturasService.atualizar(editId, payload);
      else await estruturasService.criar(payload);
      setModal(false);
      await load();
    } catch (e: any) {
      setErroForm(e?.response?.data ?? 'Erro ao salvar.');
    } finally { setSalvando(false); }
  }
  async function confirmarExclusao(e: EstruturaDto) {
    if (!(await confirmar('Excluir estrutura', `Excluir "${e.nome}"? Os ativos ligados voltam para pessoa física.`, 'Excluir'))) return;
    try { await estruturasService.deletar(e.id); await load(); }
    catch { Alert.alert('Erro', 'Não foi possível excluir.'); }
  }

  function abrirParticipacao() {
    setPPai(null); setPFilha(dados?.estruturas[0]?.id ?? ''); setPPct('100'); setPRel(1); setErroPart(null); setModalPart(true);
  }
  async function salvarParticipacao() {
    if (!pFilha) { setErroPart('Escolha a estrutura detida.'); return; }
    setSalvandoPart(true); setErroPart(null);
    try {
      await estruturasService.salvarParticipacao({
        estruturaPaiId: pPai, estruturaFilhaId: pFilha,
        percentualParticipacao: parseFloat(pPct.replace(',', '.')) || 0, tipoRelacao: pRel,
      });
      setModalPart(false);
      await load();
    } catch (e: any) {
      setErroPart(e?.response?.data ?? 'Não foi possível salvar a participação.');
    } finally { setSalvandoPart(false); }
  }
  async function removerParticipacao(id: string) {
    if (!(await confirmar('Remover participação', 'Remover esta ligação do grafo?'))) return;
    try { await estruturasService.deletarParticipacao(id); await load(); }
    catch { Alert.alert('Erro', 'Não foi possível remover.'); }
  }

  async function abrirDetalhe(id: string) {
    setDetalhe(null); setCarregandoDet(true);
    try { setDetalhe(await estruturasService.detalhe(id)); }
    catch { setCarregandoDet(false); Alert.alert('Erro', 'Não foi possível carregar o detalhe.'); return; }
    setCarregandoDet(false);
  }

  const layout = useMemo(() => computeLayout(dados, posOverrides), [dados, posOverrides]);

  const renderMapaViewport = (full: boolean) => (
    <View style={[s.mapaViewport, full && s.mapaViewportFull]}>
      <View style={{ transform: [{ scale: zoom }] }}>
        <View style={{ width: layout.width, height: layout.height }}>
          {/* arestas (atrás) */}
          <Svg width={layout.width} height={layout.height} style={{ position: 'absolute', left: 0, top: 0 }}>
            {layout.edges.map((e, i) => (
              <Path key={i} d={e.d} stroke={e.benef ? colors.blue : GOLD} strokeWidth={e.benef ? 1.2 : 1.6}
                strokeOpacity={e.benef ? 0.7 : 0.8} strokeDasharray={e.benef ? '4,4' : undefined} fill="none" />
            ))}
          </Svg>
          {/* nós (Views por cima) */}
          {layout.nodes.map(n => {
            if (n.familia || n.benef) {
              return (
                <View key={n.id} style={[s.mapNode, { left: n.x, top: n.y, width: n.w, height: n.h, borderColor: colors.blue, borderWidth: n.familia ? 2 : 1.5 }]}>
                  <Text style={[s.mapNodeTitulo, n.benef && { fontSize: 11.5 }]} numberOfLines={1}>{n.titulo}</Text>
                  <Text style={s.mapNodeSub} numberOfLines={1}>{n.sub}</Text>
                </View>
              );
            }
            return (
              <DraggableNode key={n.id} node={n} zoom={zoom} colors={colors} s={s}
                onTap={abrirDetalhe} onDragMove={onDragMove} onDragEnd={onDragEnd} />
            );
          })}
        </View>
      </View>
      {/* controles de zoom */}
      <View style={s.mapaControles}>
        <TouchableOpacity style={s.zoomBtn} onPress={() => setZoom(z => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}><Text style={s.zoomTxt}>−</Text></TouchableOpacity>
        <TouchableOpacity style={s.zoomBtn} onPress={resetMapa}><Text style={s.zoomTxt}>⟳</Text></TouchableOpacity>
        <TouchableOpacity style={s.zoomBtn} onPress={() => setZoom(z => Math.min(2, Math.round((z + 0.1) * 10) / 10))}><Text style={s.zoomTxt}>+</Text></TouchableOpacity>
      </View>
      <Text style={s.mapaDica}>arraste uma caixa p/ reposicionar · toque p/ abrir · +/− zoom</Text>
    </View>
  );

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const est = dados?.estruturas ?? [];
  const nomePorId = Object.fromEntries(est.map(e => [e.id, e.nome]));

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Estruturas</Text>
          <Text style={s.subtitle}>Trust · Holdings · Offshore — participações e valores</Text>
        </View>
        <TouchableOpacity style={s.btnNovo} onPress={novaEstrutura}>
          <Text style={s.btnNovoTxt}>+ Estrutura</Text>
        </TouchableOpacity>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}><Text style={s.kpiLabel}>Em estruturas</Text><Text style={s.kpiValor}>{fmtBRL(dados?.totalEmEstruturasBRL ?? 0)}</Text></View>
        <View style={s.kpiCard}><Text style={s.kpiLabel}>Pessoa física</Text><Text style={s.kpiValor}>{fmtBRL(dados?.totalPessoaFisicaBRL ?? 0)}</Text></View>
        <View style={s.kpiCard}><Text style={s.kpiLabel}>Estruturas</Text><Text style={s.kpiValor}>{est.length}</Text></View>
      </View>

      {/* Grafo */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>Mapa de Estruturas & Participações</Text>
          {est.length > 0 && (
            <View style={s.cardHeadAcoes}>
              <TouchableOpacity onPress={() => setFullscreen(true)}><Text style={s.link}>⛶ Tela cheia</Text></TouchableOpacity>
              <TouchableOpacity onPress={abrirParticipacao}><Text style={s.link}>+ Participação</Text></TouchableOpacity>
            </View>
          )}
        </View>
        {est.length === 0 ? (
          <Text style={s.vazio}>Nenhuma estrutura cadastrada. Toque em “+ Estrutura” para começar.</Text>
        ) : (
          renderMapaViewport(false)
        )}
      </View>

      {/* Mapa em tela cheia */}
      <Modal visible={fullscreen} animationType="slide" onRequestClose={() => setFullscreen(false)}>
        <View style={s.fsContainer}>
          <View style={s.fsHead}>
            <Text style={s.cardTitulo}>Mapa de Estruturas & Participações</Text>
            <View style={s.cardHeadAcoes}>
              <TouchableOpacity onPress={abrirParticipacao}><Text style={s.link}>+ Participação</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setFullscreen(false)}><Text style={s.link}>✕ Fechar</Text></TouchableOpacity>
            </View>
          </View>
          {renderMapaViewport(true)}
        </View>
      </Modal>

      {/* Lista de estruturas */}
      {est.map(e => (
        <TouchableOpacity key={e.id} style={s.estRow} activeOpacity={0.7} onPress={() => abrirDetalhe(e.id)}>
          <View style={{ flex: 1 }}>
            <Text style={s.estNome}>{e.nome}</Text>
            <Text style={s.estMeta}>{TIPO_LABEL[e.tipo] ?? 'Outro'}{e.jurisdicao ? ` · ${e.jurisdicao}` : ''} · {e.qtdAtivos + e.qtdInvestimentos} ativo(s)</Text>
            <Text style={s.verDetalhe}>ver ativos ›</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.estValor}>{fmtBRL(e.valorTotalBRL)}</Text>
            {e.valorDiretoBRL !== e.valorTotalBRL && <Text style={s.estDireto}>direto {fmtBRL(e.valorDiretoBRL)}</Text>}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => editar(e)}><Text style={[s.link, { color: colors.blue }]}>Editar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmarExclusao(e)}><Text style={[s.link, { color: colors.red }]}>Excluir</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Participações */}
      {(dados?.participacoes.length ?? 0) > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitulo}>Participações</Text>
          {dados!.participacoes.map(p => (
            <View key={p.id} style={s.partRow}>
              <Text style={s.partTxt}>
                {(p.estruturaPaiId ? nomePorId[p.estruturaPaiId] : 'Família')} → {nomePorId[p.estruturaFilhaId] ?? '?'} · {numBR(p.percentualParticipacao, 0)}%
              </Text>
              <TouchableOpacity onPress={() => removerParticipacao(p.id)}><Text style={[s.link, { color: colors.red }]}>Remover</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={s.rodape}>O valor de cada estrutura é derivado dos ativos/investimentos ligados a ela (em Ativos e Investimentos, campo “Pertence a”) + o percentual das estruturas que ela detém.</Text>

      {/* Detalhe da estrutura — modal */}
      <Modal visible={carregandoDet || detalhe !== null} animationType="fade" transparent onRequestClose={() => setDetalhe(null)}>
        <View style={s.centerOverlay}>
          <ScrollView style={s.centerCard} contentContainerStyle={{ paddingBottom: 8 }}>
            {carregandoDet || !detalhe ? (
              <ActivityIndicator color={colors.green} style={{ marginVertical: 40 }} />
            ) : (
              <>
                <Text style={s.modalTitulo}>{detalhe.nome}</Text>
                <Text style={s.detSub}>{TIPO_LABEL[detalhe.tipo] ?? 'Outro'}{detalhe.jurisdicao ? ` · ${detalhe.jurisdicao}` : ''}</Text>
                <View style={s.detKpis}>
                  <View style={s.detKpi}><Text style={s.detKpiLbl}>Valor total</Text><Text style={s.detKpiVal}>{fmtBRL(detalhe.valorTotalBRL)}</Text></View>
                  <View style={s.detKpi}><Text style={s.detKpiLbl}>Ativos diretos</Text><Text style={s.detKpiVal}>{fmtBRL(detalhe.valorDiretoBRL)}</Text></View>
                </View>

                <Text style={s.detSec}>Ativos & investimentos ligados</Text>
                {detalhe.itens.length === 0 ? (
                  <Text style={s.detVazio}>Nenhum ativo ligado diretamente. Use o campo “Pertence a” em Ativos/Investimentos.</Text>
                ) : detalhe.itens.map((it, i) => (
                  <View key={i} style={s.detItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detItemNome}>{it.nome}</Text>
                      <Text style={s.detItemMeta}>{it.origem === 'ativo' ? 'Ativo' : 'Investimento'} · {it.moeda}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.detItemVal}>{fmtBRL(it.valorBRL)}</Text>
                      {it.moeda !== 'BRL' && <Text style={s.detItemOrig}>{it.moeda} {numBR(it.valor, 0)}</Text>}
                    </View>
                  </View>
                ))}

                {detalhe.filhas.length > 0 && (
                  <>
                    <Text style={s.detSec}>Estruturas detidas</Text>
                    {detalhe.filhas.map(f => (
                      <View key={f.id} style={s.detItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.detItemNome}>{f.nome}</Text>
                          <Text style={s.detItemMeta}>{numBR(f.percentualParticipacao, 0)}% · total {fmtBRL(f.valorTotalBRL)}</Text>
                        </View>
                        <Text style={s.detItemVal}>{fmtBRL(f.valorParticipacaoBRL)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Distribuições cuja origem é esta estrutura + pizza por beneficiário */}
                {detalhe.distribuicoes.length > 0 && (() => {
                  const total = detalhe.distribuicoes.reduce((a, d) => a + d.valorBRL, 0);
                  const grupos = new Map<string, number>();
                  for (const d of detalhe.distribuicoes) {
                    const k = d.beneficiario ?? 'Sem beneficiário';
                    grupos.set(k, (grupos.get(k) ?? 0) + d.valorBRL);
                  }
                  const slices: DonutSlice[] = [...grupos.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, value], i) => ({ label, value, color: PALETA_DIST[i % PALETA_DIST.length] }));
                  return (
                    <>
                      <Text style={s.detSec}>Distribuições · {fmtBRL(total)}</Text>
                      <View style={s.distGrafico}>
                        <DonutChart
                          data={slices} size={132} strokeWidth={20} interactive
                          centerMain={String(slices.length)} centerSub={slices.length === 1 ? 'beneficiário' : 'beneficiários'}
                          textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
                        />
                        <View style={s.distLegenda}>
                          {slices.map((sl, i) => (
                            <View key={i} style={s.legendRow}>
                              <View style={[s.legendDot, { backgroundColor: sl.color }]} />
                              <Text style={s.legendNome} numberOfLines={1}>{sl.label}</Text>
                              <Text style={s.legendPct}>{total > 0 ? `${(sl.value / total * 100).toFixed(0)}%` : '—'}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      {detalhe.distribuicoes.map(d => (
                        <View key={d.id} style={s.detItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.detItemNome}>{d.beneficiario ?? 'Sem beneficiário'}</Text>
                            <Text style={s.detItemMeta}>{fmtData(d.data)}{d.descricao ? ` · ${d.descricao}` : ''}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.detItemVal}>{fmtBRL(d.valorBRL)}</Text>
                            {d.moeda !== 'BRL' && <Text style={s.detItemOrig}>{d.moeda} {numBR(d.valor, 0)}</Text>}
                          </View>
                        </View>
                      ))}
                    </>
                  );
                })()}

                <TouchableOpacity style={[s.btnModal, s.btnCancel, { marginTop: 18 }]} onPress={() => setDetalhe(null)}>
                  <Text style={s.btnCancelTxt}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal estrutura */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={s.modalTitulo}>{editId ? 'Editar estrutura' : 'Nova estrutura'}</Text>
            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={form.nome} onChangeText={v => setForm(f => ({ ...f, nome: v }))} placeholder="Ex: Trust Internacional" placeholderTextColor={colors.inputPlaceholder} />
            <Text style={s.label}>Tipo *</Text>
            <View style={s.chipsWrap}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.v} style={[s.chip, form.tipo === t.v && s.chipOn]} onPress={() => setForm(f => ({ ...f, tipo: t.v }))}>
                  <Text style={[s.chipTxt, form.tipo === t.v && { color: colors.green }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Jurisdição</Text>
            <TextInput style={s.input} value={form.jurisdicao ?? ''} onChangeText={v => setForm(f => ({ ...f, jurisdicao: v }))} placeholder="Ex: Zurique · Suíça" placeholderTextColor={colors.inputPlaceholder} />
            <Text style={s.label}>Observações</Text>
            <TextInput style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} value={form.observacoes ?? ''} onChangeText={v => setForm(f => ({ ...f, observacoes: v }))} multiline placeholderTextColor={colors.inputPlaceholder} />
            {erroForm && <Text style={s.erro}>{erroForm}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancel]} onPress={() => setModal(false)}><Text style={s.btnCancelTxt}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnOk]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnOkTxt}>{editId ? 'Salvar' : 'Criar'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal participação */}
      <Modal visible={modalPart} animationType="slide" transparent onRequestClose={() => setModalPart(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={s.modalTitulo}>Nova participação</Text>
            <Text style={s.label}>Detentor</Text>
            <View style={s.chipsWrap}>
              <TouchableOpacity style={[s.chip, pPai === null && s.chipOn]} onPress={() => setPPai(null)}>
                <Text style={[s.chipTxt, pPai === null && { color: colors.green }]}>Família</Text>
              </TouchableOpacity>
              {est.map(e => (
                <TouchableOpacity key={e.id} style={[s.chip, pPai === e.id && s.chipOn]} onPress={() => setPPai(e.id)}>
                  <Text style={[s.chipTxt, pPai === e.id && { color: colors.green }]}>{e.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Detém (estrutura)</Text>
            <View style={s.chipsWrap}>
              {est.filter(e => e.id !== pPai).map(e => (
                <TouchableOpacity key={e.id} style={[s.chip, pFilha === e.id && s.chipOn]} onPress={() => setPFilha(e.id)}>
                  <Text style={[s.chipTxt, pFilha === e.id && { color: colors.green }]}>{e.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>Percentual (%)</Text>
            <TextInput style={s.input} value={pPct} onChangeText={setPPct} keyboardType="decimal-pad" placeholderTextColor={colors.inputPlaceholder} />
            <Text style={s.label}>Relação</Text>
            <View style={s.chipsWrap}>
              {RELACOES.map(r => (
                <TouchableOpacity key={r.v} style={[s.chip, pRel === r.v && s.chipOn]} onPress={() => setPRel(r.v)}>
                  <Text style={[s.chipTxt, pRel === r.v && { color: colors.green }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {erroPart && <Text style={s.erro}>{erroPart}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancel]} onPress={() => setModalPart(false)}><Text style={s.btnCancelTxt}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnOk]} onPress={salvarParticipacao} disabled={salvandoPart}>
                {salvandoPart ? <ActivityIndicator color="#fff" /> : <Text style={s.btnOkTxt}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Layout do grafo por níveis (família no topo) ─────────────────────────────
interface GNode { id: string; titulo: string; sub: string; x: number; y: number; w: number; h: number; familia?: boolean; benef?: boolean; }
interface GEdge { d: string; benef?: boolean; }
const NODE_W = 190, NODE_H = 52;
function computeLayout(dados: GrafoEstruturasDto | null, overrides: Record<string, { x: number; y: number }> = {}) {
  const GAP_X = 26, GAP_Y = 70, PAD = 12;
  const BENEF_W = 128, BENEF_H = 42, BENEF_GAP = 14;
  if (!dados || dados.estruturas.length === 0) return { nodes: [] as GNode[], edges: [] as GEdge[], width: 400, height: 120 };

  const est = dados.estruturas;
  const benef = dados.beneficiarios ?? [];
  const benefOffset = benef.length > 0 ? BENEF_H + 48 : 0;
  const edgesRaw = dados.participacoes.map(p => ({ from: p.estruturaPaiId ?? 'familia', to: p.estruturaFilhaId }));
  const temPai = new Set(dados.participacoes.map(p => p.estruturaFilhaId));
  est.forEach(e => { if (!temPai.has(e.id)) edgesRaw.push({ from: 'familia', to: e.id }); });

  // profundidade via BFS a partir de família
  const filhos: Record<string, string[]> = {};
  edgesRaw.forEach(e => { (filhos[e.from] ??= []).push(e.to); });
  const depth: Record<string, number> = { familia: 0 };
  const fila = ['familia'];
  while (fila.length) {
    const cur = fila.shift()!;
    for (const f of filhos[cur] ?? []) {
      const d = (depth[cur] ?? 0) + 1;
      if (depth[f] === undefined || d > depth[f]) { depth[f] = d; fila.push(f); }
    }
  }
  est.forEach(e => { if (depth[e.id] === undefined) depth[e.id] = 1; });

  const porNivel: Record<number, string[]> = { 0: ['familia'] };
  est.forEach(e => { (porNivel[depth[e.id]] ??= []).push(e.id); });
  const niveis = Object.keys(porNivel).map(Number).sort((a, b) => a - b);
  const maxLargura = Math.max(...niveis.map(n => porNivel[n].length));
  const larguraAuto = Math.max(400, maxLargura * (NODE_W + GAP_X) + PAD * 2, benef.length * (BENEF_W + BENEF_GAP) + PAD * 2);

  // Posição AUTOMÁTICA por nível
  const pos: Record<string, { x: number; y: number }> = {};
  niveis.forEach(n => {
    const ids = porNivel[n];
    const totalW = ids.length * NODE_W + (ids.length - 1) * GAP_X;
    const startX = (larguraAuto - totalW) / 2;
    ids.forEach((id, i) => { pos[id] = { x: startX + i * (NODE_W + GAP_X), y: PAD + benefOffset + n * (NODE_H + GAP_Y) }; });
  });

  // Posição MANUAL: override (drag ao vivo) > salva (PosX/PosY) > automática
  est.forEach(e => {
    const salvo = e.posX != null && e.posY != null ? { x: e.posX, y: e.posY } : null;
    const manual = overrides[e.id] ?? salvo;
    if (manual) pos[e.id] = manual;
  });

  const nodes: GNode[] = [];
  nodes.push({ id: 'familia', titulo: 'Família', sub: benef.length ? `${benef.length} beneficiário(s)` : 'Beneficiários', ...pos['familia'], w: NODE_W, h: NODE_H, familia: true });
  est.forEach(e => nodes.push({ id: e.id, titulo: e.nome.length > 22 ? e.nome.slice(0, 21) + '…' : e.nome, sub: fmtBRL(e.valorTotalBRL), ...pos[e.id], w: NODE_W, h: NODE_H }));

  const edges: GEdge[] = edgesRaw.filter(e => pos[e.from] && pos[e.to]).map(e => {
    const a = pos[e.from], b = pos[e.to];
    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
    const my = (y1 + y2) / 2;
    return { d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}` };
  });

  // Faixa de beneficiários no topo, ligada à Família.
  if (benef.length > 0) {
    const totalW = benef.length * BENEF_W + (benef.length - 1) * BENEF_GAP;
    const startX = (larguraAuto - totalW) / 2;
    const alvo = pos['familia'];
    benef.forEach((b, i) => {
      const x = startX + i * (BENEF_W + BENEF_GAP), y = PAD;
      nodes.push({
        id: `b:${b.id}`, benef: true,
        titulo: `👤 ${b.nome.length > 12 ? b.nome.slice(0, 11) + '…' : b.nome}`,
        sub: `${PAPEL_LABEL[b.papel] ?? ''} · ${numBR(b.percentualDistribuicao, 0)}%`,
        x, y, w: BENEF_W, h: BENEF_H,
      });
      if (alvo) {
        const x1 = x + BENEF_W / 2, y1 = y + BENEF_H, x2 = alvo.x + NODE_W / 2, y2 = alvo.y;
        const my = (y1 + y2) / 2;
        edges.push({ d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`, benef: true });
      }
    });
  }

  // Dimensões acomodam também as posições manuais.
  const width = Math.max(larguraAuto, ...nodes.map(n => n.x + n.w + PAD));
  const height = Math.max(PAD * 2 + benefOffset + niveis.length * NODE_H + (niveis.length - 1) * GAP_Y, ...nodes.map(n => n.y + n.h + PAD));
  return { nodes, edges, width, height };
}

// Nó de estrutura arrastável (View sobre o SVG de arestas).
function DraggableNode({ node, zoom, colors, s, onTap, onDragMove, onDragEnd }: {
  node: GNode; zoom: number; colors: any; s: any;
  onTap: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  const latest = useRef({ node, zoom, onTap, onDragMove, onDragEnd });
  latest.current = { node, zoom, onTap, onDragMove, onDragEnd };
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { const n = latest.current.node; start.current = { x: n.x, y: n.y }; moved.current = false; },
    onPanResponderMove: (_, g) => {
      const { zoom: z, onDragMove: mv, node: n } = latest.current;
      if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) moved.current = true;
      mv(n.id, start.current.x + g.dx / (z || 1), start.current.y + g.dy / (z || 1));
    },
    onPanResponderRelease: (_, g) => {
      const { zoom: z, onTap: tap, onDragEnd: end, node: n } = latest.current;
      if (!moved.current) tap(n.id);
      else end(n.id, start.current.x + g.dx / (z || 1), start.current.y + g.dy / (z || 1));
    },
  })).current;

  return (
    <View {...pr.panHandlers} style={[s.mapNode, { left: node.x, top: node.y, width: node.w, height: node.h, borderColor: GOLD }]}>
      <Text style={s.mapNodeTitulo} numberOfLines={1}>{node.titulo}</Text>
      <Text style={s.mapNodeSub} numberOfLines={1}>{node.sub}</Text>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  btnNovo:     { backgroundColor: c.green, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  btnNovoTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  erro:        { color: c.red, fontSize: 13, marginVertical: 8 },
  kpiRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard:     { flexGrow: 1, minWidth: 120, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  kpiLabel:    { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValor:    { color: c.text, fontSize: 20, fontWeight: '900', marginTop: 6 },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 },
  cardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeadAcoes: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '800' },
  link:        { color: c.green, fontSize: 13, fontWeight: '700' },
  mapaViewport:{ height: 440, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSubtle, overflow: 'hidden', justifyContent: 'center' },
  mapaViewportFull: { flex: 1, height: '100%', marginTop: 0, borderRadius: 0, borderWidth: 0 },
  fsContainer: { flex: 1, backgroundColor: c.background, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 16 },
  fsHead:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mapNode:     { position: 'absolute', backgroundColor: c.surface, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, justifyContent: 'center' },
  mapNodeTitulo:{ color: c.text, fontSize: 13, fontWeight: '700' },
  mapNodeSub:  { color: c.textSecondary, fontSize: 10.5, marginTop: 2 },
  mapaControles:{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 },
  zoomBtn:     { width: 34, height: 34, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  zoomTxt:     { color: c.text, fontSize: 18, fontWeight: '800' },
  mapaDica:    { position: 'absolute', bottom: 8, left: 12, color: c.textTertiary, fontSize: 10, fontStyle: 'italic' },
  vazio:       { color: c.textSecondary, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  estRow:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10, gap: 10 },
  estNome:     { color: c.text, fontSize: 14, fontWeight: '700' },
  estMeta:     { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  estValor:    { color: c.text, fontSize: 15, fontWeight: '800' },
  estDireto:   { color: c.textTertiary, fontSize: 10, marginTop: 1 },
  verDetalhe:  { color: GOLD, fontSize: 11, fontWeight: '700', marginTop: 4 },
  detSub:      { color: c.textSecondary, fontSize: 13, marginTop: -6, marginBottom: 12 },
  detKpis:     { flexDirection: 'row', gap: 12, marginBottom: 8 },
  detKpi:      { flex: 1, backgroundColor: c.surfaceElevated, borderRadius: 12, padding: 12 },
  detKpiLbl:   { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
  detKpiVal:   { color: c.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  detSec:      { color: c.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 4 },
  detVazio:    { color: c.textSecondary, fontSize: 13, paddingVertical: 10 },
  detItem:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 10 },
  detItemNome: { color: c.text, fontSize: 14, fontWeight: '600' },
  detItemMeta: { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  detItemVal:  { color: c.text, fontSize: 14, fontWeight: '700' },
  detItemOrig: { color: c.textTertiary, fontSize: 10, marginTop: 1 },
  distGrafico: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 8 },
  distLegenda: { flex: 1, gap: 6 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendNome:  { flex: 1, color: c.text, fontSize: 12 },
  legendPct:   { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  secHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  f2Form:      { backgroundColor: c.surfaceElevated, borderRadius: 12, padding: 12, marginTop: 10 },
  distRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
  distBarBg:   { height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 5, marginBottom: 4, overflow: 'hidden' },
  distBarFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  partRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border },
  partTxt:     { color: c.text, fontSize: 13, flex: 1 },
  rodape:      { color: c.textTertiary, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  overlay:     { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  pagina:      { flex: 1, backgroundColor: c.background },
  pageHead:    { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  centerOverlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 16 },
  centerCard:  { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 24, width: '100%', maxWidth: 560, maxHeight: '85%', alignSelf: 'center' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  chipsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border },
  chipOn:      { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipTxt:     { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  btnModal:    { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancel:   { backgroundColor: c.surfaceElevated },
  btnCancelTxt:{ color: c.textSecondary, fontWeight: '700' },
  btnOk:       { backgroundColor: c.green },
  btnOkTxt:    { color: '#fff', fontWeight: '700' },
});
