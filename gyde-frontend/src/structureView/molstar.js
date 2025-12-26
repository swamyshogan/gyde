
import { Viewer } from 'molstar/lib/apps/viewer/app'
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { Script } from 'molstar/lib/mol-script/script';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { StructureSelectionQueries } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { StructureElement, StructureProperties, QueryContext } from 'molstar/lib/mol-model/structure';
import { alignAndSuperpose } from 'molstar/lib/mol-model/structure/structure/util/superposition';
import { StructureSelection } from 'molstar/lib/mol-model/structure/query';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { elementLabel, structureElementStatsLabel } from 'molstar/lib/mol-theme/label';
import { ObjectKeys } from 'molstar/lib/mol-util/type-helpers';
import { PluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { stripTags } from 'molstar/lib/mol-util/string';
import { Color } from 'molstar/lib/mol-util/color';
import { CustomElementProperty } from 'molstar/lib/mol-model-props/common/custom-element-property';
import { getLetterToSequenceNumber, getMolstarChainIndexToSequenceIndex } from '../utils/structureUtils'
import { DefaultPluginUISpec, PluginUISpec } from 'molstar/lib/mol-plugin-ui/spec'
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { Plugin } from 'molstar/lib/mol-plugin-ui/plugin'
import { SequenceView, getStructureOptions, getModelEntityOptions, getChainOptions, getOperatorOptions } from 'molstar/lib/mol-plugin-ui/sequence';
import { ViewerAutoPreset } from 'molstar/lib/apps/viewer/app';
import { arrayEqual as molstarArrayEqual } from 'molstar/lib/mol-util/array';


import { Backgrounds } from 'molstar/lib/extensions/backgrounds';
import { ModelExport } from 'molstar/lib/extensions/model-export';
import { Mp4Export } from 'molstar/lib/extensions/mp4-export';
import { GeometryExport } from 'molstar/lib/extensions/geo-export';
import { wwPDBChemicalComponentDictionary } from 'molstar/lib/extensions/wwpdb/ccd/behavior';
import { StructureFocusRepresentation } from 'molstar/lib/mol-plugin/behavior/dynamic/selection/structure-focus-representation';

import { interpolateViridis, interpolateMagma, interpolateRdBu } from 'd3';
import { interpolateRgb } from 'd3-interpolate';
import 'molstar/build/viewer/molstar.css'

import * as namedColours from 'color-name';
import {rgbStringToHex} from '../utils/utils';

export {Plugin};


/* MolStar create-embed code.  This is somewhat-based on Viewer.create from MolStar
   (MIT license), but trimmed and adapter for our requirements, and to avoid
   force-creating a new React route */

const ExtensionMap = {
    'backgrounds': PluginSpec.Behavior(Backgrounds),
    'model-export': PluginSpec.Behavior(ModelExport),
    'mp4-export': PluginSpec.Behavior(Mp4Export),
    'geo-export': PluginSpec.Behavior(GeometryExport),
    'wwpdb-chemical-component-dictionary': PluginSpec.Behavior(wwPDBChemicalComponentDictionary)
};

const DefaultViewerOptions = {
    customFormats: [],
    extensions: ObjectKeys(ExtensionMap),
    disabledExtensions: [],
    layoutIsExpanded: true,
    layoutShowControls: true,
    layoutShowRemoteState: true,
    layoutControlsDisplay: 'reactive',
    layoutShowSequence: true,
    layoutShowLog: true,
    layoutShowLeftPanel: true,
    collapseLeftPanel: false,
    collapseRightPanel: false,
    disableAntialiasing: PluginConfig.General.DisableAntialiasing.defaultValue,
    pixelScale: PluginConfig.General.PixelScale.defaultValue,
    pickScale: PluginConfig.General.PickScale.defaultValue,
    // transparency: PluginConfig.General.Transparency.defaultValue,
    preferWebgl1: PluginConfig.General.PreferWebGl1.defaultValue,
    allowMajorPerformanceCaveat: PluginConfig.General.AllowMajorPerformanceCaveat.defaultValue,
    powerPreference: PluginConfig.General.PowerPreference.defaultValue,

    viewportShowExpand: PluginConfig.Viewport.ShowExpand.defaultValue,
    viewportShowControls: PluginConfig.Viewport.ShowControls.defaultValue,
    viewportShowSettings: PluginConfig.Viewport.ShowSettings.defaultValue,
    viewportShowSelectionMode: PluginConfig.Viewport.ShowSelectionMode.defaultValue,
    viewportShowAnimation: PluginConfig.Viewport.ShowAnimation.defaultValue,
    viewportShowTrajectoryControls: PluginConfig.Viewport.ShowTrajectoryControls.defaultValue,
    pluginStateServer: PluginConfig.State.DefaultServer.defaultValue,
    volumeStreamingServer: PluginConfig.VolumeStreaming.DefaultServer.defaultValue,
    volumeStreamingDisabled: !PluginConfig.VolumeStreaming.Enabled.defaultValue,
    pdbProvider: PluginConfig.Download.DefaultPdbProvider.defaultValue,
    emdbProvider: PluginConfig.Download.DefaultEmdbProvider.defaultValue,
    saccharideCompIdMapType: 'default'
};

export async function createMolStarPlugin(extOptions={}) {
    const options = {
        layoutIsExpanded: false,
        layoutShowRemoteState: false,
        layoutShowSequence: true,
        layoutShowLog: false,
        layoutShowLeftPanel: false,

        viewportShowExpand: true,
        viewportShowControls: true,
        viewportShowSelectionMode: true,
        viewportShowAnimation: false,
        viewportShowTrajectoryControls: false,
        volumesAndSegmentationsDefaultServer: null,
        volumeStreamingDisabled: true,

        pdbProvider: 'rcsb',
        emdbProvider: 'rcsb',
        disabledExtensions: ['volseg'],
        ...extOptions
    };

    const definedOptions = {};
    // filter for defined properies only so the default values
    // are property applied
    for (const p of Object.keys(options)) {
        if (options[p] !== undefined) definedOptions[p] = options[p];
    }

    const o = { ...DefaultViewerOptions, ...definedOptions };
    const defaultSpec = DefaultPluginUISpec();

    const disabledExtension = new Set(o.disabledExtensions ?? []);

    const spec = {
        actions: defaultSpec.actions,
        behaviors: [
            ...defaultSpec.behaviors,
            PluginSpec.Behavior(StructureFocusRepresentation, { expandRadius: 8 }),
            ...o.extensions.filter(e => !disabledExtension.has(e)).map(e => ExtensionMap[e]),
        ],
        animations: [...defaultSpec.animations || []],
        customParamEditors: defaultSpec.customParamEditors,
        customFormats: o?.customFormats,
        layout: {
            initial: {
                isExpanded: o.layoutIsExpanded,
                showControls: o.layoutShowControls,
                controlsDisplay: o.layoutControlsDisplay,
                regionState: {
                    bottom: 'full',
                    left: o.collapseLeftPanel ? 'collapsed' : 'full',
                    right: o.collapseRightPanel ? 'hidden' : 'full',
                    top: 'full',
                }
            },
        },
        components: {
            ...defaultSpec.components,
            controls: {
                ...defaultSpec.components?.controls,
                top: o.layoutShowSequence ? GydeSequenceView : 'none',
                bottom: o.layoutShowLog ? undefined : 'none',
                left: o.layoutShowLeftPanel ? undefined : 'none',
            },
            sequenceViewer: {
                view: GydeSequenceView
            },
            remoteState: o.layoutShowRemoteState ? 'default' : 'none',
        },
        config: [
            [PluginConfig.General.DisableAntialiasing, o.disableAntialiasing],
            [PluginConfig.General.PixelScale, o.pixelScale],
            [PluginConfig.General.PickScale, o.pickScale],
            [PluginConfig.General.Transparency, o.transparency],
            [PluginConfig.General.PreferWebGl1, o.preferWebgl1],
            [PluginConfig.General.AllowMajorPerformanceCaveat, o.allowMajorPerformanceCaveat],
            [PluginConfig.General.PowerPreference, o.powerPreference],
            [PluginConfig.Viewport.ShowExpand, o.viewportShowExpand],
            [PluginConfig.Viewport.ShowControls, o.viewportShowControls],
            [PluginConfig.Viewport.ShowSettings, o.viewportShowSettings],
            [PluginConfig.Viewport.ShowSelectionMode, o.viewportShowSelectionMode],
            [PluginConfig.Viewport.ShowAnimation, o.viewportShowAnimation],
            [PluginConfig.Viewport.ShowTrajectoryControls, o.viewportShowTrajectoryControls],
            [PluginConfig.State.DefaultServer, o.pluginStateServer],
            [PluginConfig.State.CurrentServer, o.pluginStateServer],
            [PluginConfig.VolumeStreaming.DefaultServer, o.volumeStreamingServer],
            [PluginConfig.VolumeStreaming.Enabled, !o.volumeStreamingDisabled],
            [PluginConfig.Download.DefaultPdbProvider, o.pdbProvider],
            [PluginConfig.Download.DefaultEmdbProvider, o.emdbProvider],
            [PluginConfig.Structure.DefaultRepresentationPreset, ViewerAutoPreset.id],
            [PluginConfig.Structure.SaccharideCompIdMapType, o.saccharideCompIdMapType],
        ]
    };

    const ctx = new PluginUIContext(spec || DefaultPluginUISpec());
    await ctx.init();
    {
        // the preset needs to be added before the UI renders otherwise
        // "Download Structure" wont be able to pick it up
        ctx.builders.structure.representation.registerPreset(ViewerAutoPreset);
    }

    return ctx;
}


/* End Mol* creation */

/* Override of Mol* SequenceView UI to allow us to hide alignment_structure 
   The implementation of sync and getInitialstate are mostly copied from Mol* [MIT license]
   but need to be here to allow the "filtering" code to be inserted */

function getStructureOptionsFiltered(state) {
    const {options, all} = getStructureOptions(state);

    const newOptions = [], newAll = [];
    for (let i = 0; i < all.length; ++i) {
        if (options[i][1] === 'alignment_structure') {
            continue;
        } 

        newOptions.push(options[i]); newAll.push(options[i]);
    }

    if (newOptions.length === 0) newOptions.push(['', 'No structure']);

    return {all: newAll, options: newOptions};
}

class GydeSequenceView extends SequenceView {
    sync() {
        
        const structureOptions = getStructureOptionsFiltered(this.plugin.state.data);
        if (molstarArrayEqual(structureOptions.all, this.state.structureOptions.all)) return;
        this.setState(this.getInitialState());
    }

    getInitialState() {
        const structureOptions = getStructureOptionsFiltered(this.plugin.state.data);
        const structureRef = structureOptions.options[0][0];
        const structure = this.getStructure(structureRef);
        let modelEntityId = getModelEntityOptions(structure)[0][0];
        let chainGroupId = getChainOptions(structure, modelEntityId)[0][0];
        let operatorKey = getOperatorOptions(structure, modelEntityId, chainGroupId)[0][0];
        if (this.state.structure && this.state.structure === structure) {
            modelEntityId = this.state.modelEntityId;
            chainGroupId = this.state.chainGroupId;
            operatorKey = this.state.operatorKey;
        }
        return { structureOptions, structure, structureRef, modelEntityId, chainGroupId, operatorKey, mode: this.props.defaultMode ?? 'single' };
    }
}

/* End SequenceView override */

export function setMolstarControlsVisibility(viewer, isVisible) {
    PluginCommands.Layout.Update(viewer.plugin, { state: { showControls: isVisible } });
}


function getSelectionTree(entries) {
    const selectionByModel = {};
    for (const entry of entries.values()) {
        const selectedResidues = {};
        const model =  entry.selection.structure.model;
        const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
        const chainIndex = model.atomicHierarchy.chainAtomSegments.index;
        const chains = model.atomicHierarchy.chains.auth_asym_id.toArray();

        StructureElement.Loci.forEachLocation(
            entry.selection,
            (location) => {
                const chain = StructureProperties.chain.auth_asym_id(location),
                      residue = '' + StructureProperties.residue.auth_seq_id(location) + StructureProperties.residue.pdbx_PDB_ins_code(location);

                if (!selectedResidues[chain]) selectedResidues[chain] = new Set();
                selectedResidues[chain].add((residue));
            }
        );

        const structureLabel = model.label;
        selectionByModel[structureLabel] = selectedResidues;
    }

    return selectionByModel;
}

function compareSelectionTrees(newTree, oldTree) {
    const diff = {};
    const keys = new Set([...Object.keys(newTree), ...Object.keys(oldTree)]);
    for (const k of keys) {
        const oldSel = oldTree[k] || {},
              newSel = newTree[k] || {};
        const chains = new Set([...Object.keys(newSel), ...Object.keys(oldSel)]);

        if ([...chains].some((c) => !compareSets(newSel[c], oldSel[c]))) {
            diff[k] = newSel;
        }
    }
    return diff;
}

function compareSets(s, t) {
    if (!s) {
        if (!t) {
            return true;
        } else {
            return false;
        }
    } else if (!t) {
        return false;
    }

    if (s.size !== t.size) return false;

    for (const v of s) {
        if (!t.has(v)) return false;
    }

    return true;
}

export function molstarRegisterSelectionListener(viewer, listener) {
    const sub = viewer.plugin.managers.interactivity.lociSelects.sel.events.changed.subscribe((x) => {
        const newTree = getSelectionTree(viewer.plugin.managers.interactivity.lociSelects.sel.entries);
        const oldTree = viewer._gyde_cached_selectionTree || {};

        const diff = compareSelectionTrees(newTree, oldTree);

        viewer._gyde_cached_selectionTree = newTree;
        if (Object.entries(diff).length > 0) {
            listener(diff, getAtomicMappings(viewer));
        }
    });

    viewer._gyde_cached_selectionTree = getSelectionTree(viewer.plugin.managers.interactivity.lociSelects.sel.entries);
    return sub;
}

export async function setModelIndex(viewer, structureLabel, n) {
    await viewer.plugin.dataTransaction(() => {
        const state = viewer.plugin.state.data;
        const models = state.selectQ(q => q.ofTransformer(StateTransforms.Model.ModelFromTrajectory));
        const update = state.build();
        for (const m of models) {
            if (m.obj?.data?.label === structureLabel) {
                update.to(m).update({modelIndex: n});
            }
        }
        return update.commit();
    });
}

export function labelClash(viewer, structureLabel) {
    let result = false;

    const currModels = viewer.plugin.managers.structure.hierarchy.state.hierarchy.models;
    for (const model of currModels || []) {
        const data = model.cell.obj.data;
        if (data.label === structureLabel) {
            result = true;
        }
    }

    return result;
}

export function getModelIndexFromLabel(viewer, label) {
    let result = null;

    const models = viewer.plugin.managers.structure.hierarchy.state.hierarchy.models;
    models.forEach((model, i) => {
        if (model.cell.obj.data.label === label) result = i;
    })

    return result;
}

export function getStructureRefFromLabel(viewer, label) {
    const trajectories = viewer.plugin.managers.structure.hierarchy.state.hierarchy.trajectories;
    const models = viewer.plugin.managers.structure.hierarchy.state.hierarchy.models;
    const num_structures = trajectories.length;

    let ref = null;

    for (let i = 0; i < num_structures; i++) {
        if (models[i].cell.obj.data.label === label) {
            ref = trajectories[i].cell.transform.parent;
            break;
        }
    }
    
    return ref;
}

export async function deleteStructureByRef(viewer, structureRef) {
    const data = viewer.plugin.state.data;
    const update = data.build().delete(structureRef);
    return await update.commit();
}

export function molstarClearSelection(viewer) {
    viewer.plugin.managers.interactivity.lociSelects.deselectAll();
}

export function molstarSelectResiduesMulti(viewer, residuesByLabel, residuesRaw) {
    viewer.plugin.managers.interactivity.lociSelects.deselectAll();
    viewer.plugin.dataTransaction(async () => {
        for (const structure of viewer.plugin.managers.structure.hierarchy.current.structures) {
            const structureLabel = structure.model.cell.obj.data.label;

            const data = structure.cell.obj?.data;
            if (!data || !data.state?.model) continue;

            const residues = residuesByLabel[structureLabel];
            if (!residues) continue;

            const residueIndex = data.state.model.atomicHierarchy.residueAtomSegments.index;
            const chainIndex = data.state.model.atomicHierarchy.chainAtomSegments.index;
            const chains = data.state.model.atomicHierarchy.chains.auth_asym_id.toArray();

            const residuesByChain = {};
            for (const [chain, rnum] of residues) {
                if (!residuesByChain[chain]) residuesByChain[chain] = [];
                residuesByChain[chain].push(rnum)
            }

            for (const [chain, rnums] of Object.entries(residuesByChain)) {
                let residueFudge = 0;
                if (residuesRaw) {
                    const chainNum = chains.indexOf(chain);
                    residueFudge = chainNum >= 0 ? minChainIndex(residueIndex, chainIndex, chainNum) : 10000000;
                }

                const selection = Script.getStructureSelection(
                    Q => {
                        return Q.struct.generator.atomGroups({
                            'chain-test': Q.core.rel.eq([chain, Q.ammp('auth_asym_id')]),
                            'residue-test': Q.core.logic.or(rnums.map((rnum) => {
                                if (residuesRaw) {
                                    return Q.core.rel.eq([parseInt(rnum) + residueFudge, Q.struct.atomProperty.macromolecular.residueKey()]);
                                } else {
                                    return Q.core.logic.and([
                                        Q.core.rel.eq([
                                            parseInt(rnum),
                                            Q.struct.atomProperty.macromolecular.auth_seq_id()
                                        ]),
                                        Q.core.rel.eq([
                                            (rnum.charCodeAt(rnum.length - 1) >= 65) ? rnum.substring(rnum.length - 1) : '',
                                            Q.struct.atomProperty.macromolecular.pdbx_PDB_ins_code()
                                        ])
                                    ]);
                                }
                            }))
                        })
                    },
                    data
                );
                const loci = StructureSelection.toLociWithSourceUnits(selection);
                viewer.plugin.managers.interactivity.lociSelects.select({loci});
            }
        }
    });
}

export async function molstarApplyChainTheme(viewer) {
    await viewer.plugin.dataTransaction(async () => {
        for (const s of viewer.plugin.managers.structure.hierarchy.current.structures) {
            await viewer.plugin.managers.structure.component.updateRepresentationsTheme(
                s.components, 
                { 
                    color: 'chain'
                }
            )
        }
    });
}

export async function molstarApplyDisorderTheme(viewer, key) {
    await viewer.plugin.dataTransaction(async () => {
        const colorParams = {
            domain: [0, 100],
            list: {
                kind: 'interpolate',
                colors: [[0xff4500, 0.0], [0xff4500, 0.49], [0xffdb13, 0.5], [0x65cbf3, 0.7], [0x00d6ff, 0.9], [0x0053d6, 1.0]]
            }
        };

        await Promise.all(viewer.plugin.managers.structure.hierarchy.current.structures.filter((s) => 
                s.model.cell.obj.data.label === key
            ).map((s) => 
                viewer.plugin.managers.structure.component.updateRepresentationsTheme(
                    s.components, 
                    { 
                        color: 'uncertainty',
                        colorParams
                    }
                )
            ));
    });
}

function stashThemeForCleanup(viewer, theme) {
    if (!viewer.__gyde__oldThemes) {
        viewer.__gyde__oldThemes = [];
    }
    viewer.__gyde__oldThemes.push(theme);
}

export function cleanupThemes(viewer) {
    for (const theme of (viewer.__gyde__oldThemes || [])) {
        viewer.plugin.representation.structure.themes.colorThemeRegistry.remove(theme.colorThemeProvider);
        viewer.plugin.customModelProperties.unregister(theme.propertyProvider);
        viewer.plugin.managers.lociLabels.removeProvider(theme.labelProvider);
    }
    viewer.__gyde__oldThemes = [];
}

export async function molstarApplyTheme(viewer, chainData, key) {
    await viewer.plugin.dataTransaction(async () => {
        const theme = makeGydeTheme(chainData, key);
        viewer.plugin.representation.structure.themes.colorThemeRegistry.add(theme.colorThemeProvider);
        viewer.plugin.customModelProperties.register(theme.propertyProvider, true);
        viewer.plugin.managers.lociLabels.addProvider(theme.labelProvider);
        stashThemeForCleanup(viewer, theme);

        await Promise.all(viewer.plugin.managers.structure.hierarchy.current.structures.filter((s) => 
            s.model.cell.obj.data.label === key
        ).map((s) => 
            viewer.plugin.managers.structure.component.updateRepresentationsTheme(s.components, { color: theme.propertyProvider.descriptor.name })
        ));
    });
}

let __theme_seed = 0;

function processChainFeatures(featureArray, features, augSeq, mapping, residueMap, frameworkFeature) {
    if (!augSeq) return;

    // mapping may be *either* a full mapping from Gystics, or a number (treated as an offset)

    const gapMap = [];
    for (let i = 0, j = 0; i < augSeq.length; ++i) {
        if (augSeq[i] === '-') {
            gapMap[i] = null;
        } else {
            const seqPos = j++;
            if (mapping instanceof Array) {
                if (mapping[seqPos]?.value?.residueNumber) {
                    gapMap[i] = residueMap[mapping[seqPos].value.residueNumber];
                } else {
                    gapMap[i] = null;
                }
            } else {
                gapMap[i] = seqPos + mapping;
            }
        }
        if (typeof(gapMap[i]) === 'number') featureArray[gapMap[i]] = frameworkFeature
    }

    for (const f of features) {
        if (f.source === 'CDRs' && f.feature) {
            for (let i = f.start-1; i < f.end; ++i) {
                if (gapMap[i] !== null) featureArray[gapMap[i]] = f.feature;
            }
        }
        else if (f.source === 'Vernier positions') {
            for (let i = f.start-1; i < f.end; ++i) {
                if (gapMap[i] !== null) featureArray[gapMap[i]] = 'vernier'
            }
        }
    }
}

function minChainIndex(residueIndex, chainIndex, chain) {
    let minidx = 100000000;
    for (let i = 0; i < residueIndex.length; ++i) {
        if (chainIndex[i] === chain && residueIndex[i] < minidx) minidx = residueIndex[i];
    }
    return minidx;
}


function atomicMapping(residueIndex, chainIndex, chain, residues, atoms) {
    const auth_seq_id = residues.auth_seq_id.toArray(),
          inscodes = residues.pdbx_PDB_ins_code.toArray(),
          atomAuthComps = atoms.auth_comp_id.toArray();

    const mapping = [];
    let lastResidue = -1000;
    for (let i = 0; i < residueIndex.length; ++i) {
        if (chainIndex[i] === chain && residueIndex[i] !== lastResidue) {
            mapping.push({
                value: {
                    residue: atomAuthComps[i],
                    residueNumber: auth_seq_id[residueIndex[i]] + inscodes[residueIndex[i]]
                }
            });
            lastResidue = residueIndex[i];
        }

    }
    return mapping;
}

function residueMap(residueIndex, chainIndex, chain, residues) {
    const auth_seq_id = residues.auth_seq_id.toArray(),
          inscodes = residues.pdbx_PDB_ins_code.toArray();

    const mapping = {};
    for (let i = 0; i < residueIndex.length; ++i) {
        if (chainIndex[i] === chain) {
            mapping[auth_seq_id[residueIndex[i]] + inscodes[residueIndex[i]]] = residueIndex[i];
        }

    }
    return mapping;
}

export function atomicMappingsForModel(model) {
    const residueIndex = model.atomicHierarchy.residueAtomSegments.index,
          chainIndex = model.atomicHierarchy.chainAtomSegments.index,
          chains = model.atomicHierarchy.chains.auth_asym_id.toArray(),
          residues = model.atomicHierarchy.residues,
          atoms = model.atomicHierarchy.atoms;

    const mappings = {};
    chains.forEach((chain, chainNum) => {
        const am = atomicMapping(residueIndex, chainIndex, chainNum, residues, atoms);
        if (!mappings[chain] || mappings[chain].length < am.length) mappings[chain] = am;   // Handle non-AA bits of MOE structures
    });
    return mappings;
}

export function getAtomicMappings(viewer) {
    const mappingsByStructureLabel = {};

    for (const structure of viewer.plugin.managers.structure.hierarchy.current.structures) {
        const data = structure?.cell.obj?.data;
        if (!data) continue;

        const structureLabel = structure.model.cell.obj.data.label,
              model = data.state.model;

        if (structureLabel === 'alignment_structure') continue;

        if (model) {
            mappingsByStructureLabel[structureLabel] = atomicMappingsForModel(model);
        }
    }
    return mappingsByStructureLabel;
}

function makeGydeTheme(chainData, key) {
    const id = __theme_seed++;

    const colorMap = {
        'framework_heavy': Color(0xccccf8),
        'framework_light': Color(0xeee8cc),
        'framework': Color(0xdddddd),
        'vernier': Color(0xbbbbbb)
    };

    for (const f of [].concat(...chainData.map((c) => c.features || []))) {
        if (f.source === 'CDRs' && f.feature) {
            if (f.color && f.color.startsWith('#')) {
                colorMap[f.feature] = Color(parseInt(f.color.substring(1), 16))
            } else if (namedColours[f.color]) {
                const [r, g, b] = namedColours[f.color];
                colorMap[f.feature] = Color((r<<16) | (g<<8) || b);
            } else {
                colorMap[f.feature] = Color(0x333333);
            }
        }
    }

    return CustomElementProperty.create({
        label: 'CDRs',
        name: '--gyde-cdrs-' + key + '-' + id,
        contextHash: id,
        getData(model) {
            const map = new Map();
            const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
            const chainIndex = model.atomicHierarchy.chainAtomSegments.index;

            const chains = model.atomicHierarchy.chains.auth_asym_id.toArray();
            const chainFeatures = [];
            // for (let i = 0; i < chains.length; ++i) chainFeatures[i] = [];

            chains.forEach((chain, chainNumber) => {
                for (const {aligned, features, mapping, chains: entryChains, defaultStyle} of chainData) {
                    const augSeq = aligned[0];
                    if (entryChains.split(',').indexOf(chain) >= 0) {
                        processChainFeatures(
                            chainFeatures,
                            features,
                            augSeq,
                            mapping || minChainIndex(residueIndex, chainIndex, chainNumber),
                            residueMap(residueIndex, chainIndex, chainNumber, model.atomicHierarchy.residues),
                            defaultStyle || 'framework'
                        );
                    }
                }
            });

            for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
                map.set(i, chainFeatures[residueIndex[i]] || 'framework');
            }
            return { value: map };
        },
        coloring: {
            getColor(e) { return colorMap[e] },
            defaultColor: Color(0x777777)
        },
        getLabel(e) {
            return e;
        }
    });
}

/// dataArray: numer[]
export async function applyDataTheme(viewer, dataArray, structureChains, colorMap, key, index, metric, heatmapColumn, mappings) {
    const theme = createDataTheme(dataArray, structureChains, colorMap, key, index, metric, heatmapColumn, mappings);
    viewer.plugin.representation.structure.themes.colorThemeRegistry.add(theme.colorThemeProvider);
    viewer.plugin.customModelProperties.register(theme.propertyProvider, true);
    viewer.plugin.managers.lociLabels.addProvider(theme.labelProvider);
    stashThemeForCleanup(viewer, theme);
    
    await Promise.all(viewer.plugin.managers.structure.hierarchy.current.structures.filter((s) => 
        s.model.cell.obj.data.label === key
    ).map((s) => 
        viewer.plugin.managers.structure.component.updateRepresentationsTheme(s.components, { color: theme.propertyProvider.descriptor.name })
    ));
}


function interpolatePLDDT(v) {
    if (v < 0.5) {
        return '#ff4500';
    } else if (v < 0.7) {
        return rgbStringToHex(interpolateRgb('#ffdb13', '#65cbf3')((v-0.5)/0.2));
    } else if (v < 0.9) {
        return rgbStringToHex(interpolateRgb('#65cbf3', '#00d6ff')((v-0.7)/0.2));
    } else {
        return rgbStringToHex(interpolateRgb('#00d6ff', '#0053d6')((v-0.9)/0.1));
    }
}


function createDataTheme(data, structureChains, colorMap, key, index, metric, heatmapColumn, mappings) {
    const reverseMappings = mappings?.map((m) => {
        const rm = {};
        m.forEach((v, i) => {
            if (v && v.value && v.value.residueNumber) rm[v.value.residueNumber] = i;
        });
        return rm;
    });

    const id = __theme_seed++;
    return CustomElementProperty.create({
        name: `custom-coloring-by-residue-${key}-${index}-${metric}-${heatmapColumn}-${id}`,
        label: 'Custom Data',
        getData(model) {
            const map = new Map();
            const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
            const chainIndex = model.atomicHierarchy.chainAtomSegments.index;
            const chainIndexToEntityIndex = model.atomicHierarchy.index.map.chain_index_entity_index;
            const entityTypes = model.entities.subtype.toArray();

            const chains = model.atomicHierarchy.chains.auth_asym_id.toArray();
            let structure_chains = model.atomicHierarchy.chains.auth_asym_id.toArray();

            // TODO: move this out
            if (!!structureChains) {
                structure_chains = structureChains;
            }

            // Handle situations where columns in the data set are mapped to no chain.
            data = data.filter((d, i) => structure_chains[i]);
            structure_chains = structure_chains.filter((c) => c);

            const molstarChainIndexToSequenceIndex = getMolstarChainIndexToSequenceIndex(chains, chainIndexToEntityIndex, entityTypes);
            const letterToSequenceNumber = getLetterToSequenceNumber(structure_chains);
            
            const sequences = model.sequence.sequences;
            const reversedIndexMaps = sequences.map((seq) => {
                const indexMap = seq.sequence.indexMap;
                return new Map(Array.from(indexMap, x => x.reverse()))
            });
            
            const auth_seq_id = model.atomicHierarchy.residues.auth_seq_id.toArray(),
                  inscodes = model.atomicHierarchy.residues.pdbx_PDB_ins_code.toArray();

            let numResidues = 0;
            let currentChainNumber = chainIndex[0];
            let currentResidueNumber = residueIndex[0];
            let gapOffset = 0;

            try {
                for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
                    const residueNumber = residueIndex[i];
                    const chainNumber = chainIndex[i];

                    // get the index of a sequence in dataArray
                    const sequenceNumber = letterToSequenceNumber.get(chains[chainNumber]);
                    if (sequenceNumber === undefined) {
                        map.set(i, -1)
                        continue;
                    }

                    // get the index of a sequence in molstar
                    const molstarSequenceIndex = molstarChainIndexToSequenceIndex.get(chainNumber)
                    if (molstarSequenceIndex === null) {
                        map.set(i, -1)
                        continue;
                    }
    
                    if (residueNumber !== currentResidueNumber) {
                        currentResidueNumber = residueNumber;
                        numResidues += 1;
                    } 

                    if (chainNumber !== currentChainNumber) {
                        numResidues = 0;
                        currentChainNumber = chainNumber;
                    }

                    let lookupResidue = numResidues;
                    if (reverseMappings && reverseMappings[sequenceNumber]) {
                        const res = reverseMappings[sequenceNumber]['' + auth_seq_id[residueNumber] + inscodes[residueNumber]];
                        if (typeof(res) != 'number') continue;
                        lookupResidue = res;
                    }

                    gapOffset = data[sequenceNumber].gaps[lookupResidue + gapOffset] || 0;
                    map.set(i, data[sequenceNumber].values[lookupResidue + gapOffset]);
                }
            } catch (err) {
                console.log(err)
            }
            
            return { value: map };
        },
        coloring: {
            getColor(value) {
                if (value < 0) {
                    return Color(0xbbbbbb);
                }
                else {
                    let colorString = '';
                    if (colorMap === 'magma') colorString = interpolateMagma(value);
                    else if (colorMap === 'viridis') colorString = interpolateViridis(value);
                    else if (colorMap === 'viola') colorString = rgbStringToHex(interpolateRdBu(1.0 - value));
                    else if (colorMap === 'bky') colorString = interpolateBky(value);
                    else if (colorMap === 'pLDDT') colorString = interpolatePLDDT(value);

                    const colorHex = parseInt(colorString.slice(1), 16);
                    return Color(colorHex);
                }
            },
            defaultColor: Color(0x777777)
        },
        getLabel(value) {
            return `${metric}: ${(value < 0)? '-' : value}`;
        }
    })
}



export async function applyDiffsTheme(viewer, highlightPosn) {
    await viewer.plugin.dataTransaction(async () => {
        const theme = createDiffsTheme(highlightPosn);
        viewer.plugin.representation.structure.themes.colorThemeRegistry.add(theme.colorThemeProvider);
        viewer.plugin.customModelProperties.register(theme.propertyProvider, true);
        viewer.plugin.managers.lociLabels.addProvider(theme.labelProvider);
        stashThemeForCleanup(viewer, theme);
        
        for (const s of viewer.plugin.managers.structure.hierarchy.current.structures) {
            await viewer.plugin.managers.structure.component.updateRepresentationsTheme(s.components, { color: theme.propertyProvider.descriptor.name })
        }
    });
}


function createDiffsTheme(highlightPosn) {
    const id = __theme_seed++;
    return CustomElementProperty.create({
        name: `diffs-${id}`,
        label: 'Diffs',
        getData(model) {
            const label = model.label;
            const highlights = highlightPosn[label];
            const highlightResidues = new Set();
            for (const [chain, residue] of highlights || []) {
                highlightResidues.add(`${chain}${residue}`);
            }

            const map = new Map();
            const residueIndex = model.atomicHierarchy.residueAtomSegments.index;
            const chainIndex = model.atomicHierarchy.chainAtomSegments.index;
            const chainIndexToEntityIndex = model.atomicHierarchy.index.map.chain_index_entity_index;
            const entityTypes = model.entities.subtype.toArray();

            const chains = model.atomicHierarchy.chains.auth_asym_id.toArray();
            let structure_chains = model.atomicHierarchy.chains.auth_asym_id.toArray();

            const molstarChainIndexToSequenceIndex = getMolstarChainIndexToSequenceIndex(chains, chainIndexToEntityIndex, entityTypes);
            const letterToSequenceNumber = getLetterToSequenceNumber(structure_chains);
            
            const sequences = model.sequence.sequences;
            const reversedIndexMaps = sequences.map((seq) => {
                const indexMap = seq.sequence.indexMap;
                return new Map(Array.from(indexMap, x => x.reverse()))
            });
            
            const auth_seq_id = model.atomicHierarchy.residues.auth_seq_id.toArray(),
                  inscodes = model.atomicHierarchy.residues.pdbx_PDB_ins_code.toArray();

            let numResidues = 0;
            let currentChainNumber = chainIndex[0];
            let currentResidueNumber = residueIndex[0];
            let gapOffset = 0;

            try {
                for (let i = 0, _i = model.atomicHierarchy.atoms._rowCount; i < _i; i++) {
                    const residueNumber = residueIndex[i];
                    const chainNumber = chainIndex[i];

                    // get the index of a sequence in dataArray
                    const sequenceNumber = letterToSequenceNumber.get(chains[chainNumber]);
                    if (sequenceNumber === undefined) {
                        map.set(i, -1)
                        continue;
                    }

                    // get the index of a sequence in molstar
                    const molstarSequenceIndex = molstarChainIndexToSequenceIndex.get(chainNumber)
                    if (molstarSequenceIndex === null) {
                        map.set(i, -1)
                        continue;
                    }
    
                    if (residueNumber !== currentResidueNumber) {
                        currentResidueNumber = residueNumber;
                        numResidues += 1;
                    } 

                    if (chainNumber !== currentChainNumber) {
                        numResidues = 0;
                        currentChainNumber = chainNumber;
                    }

                    const highlight = highlightResidues.has(`${chains[chainNumber]}${auth_seq_id[residueNumber]}${inscodes[residueNumber]}`);
                    map.set(i, highlight ? 1 : -1);
                }
            } catch (err) {
                console.log(err)
            }
            
            return { value: map };
        },
        coloring: {
            getColor(value) {
                if (value > 0) {
                    return Color(0xbb2222);
                } else {
                    return Color(0xcccccc)
                }
            },
            defaultColor: Color(0x777777)
        },
        getLabel(value) {
            return `${(value > 0)? '+' : '-'}`;
        }
    })
}



export const lociForWholeChain = (viewer, structureIndex, chainIndex) => {
    const data = viewer.plugin.managers.structure.hierarchy.current.structures[structureIndex]?.cell.obj?.data;

    const sel = Script.getStructureSelection(Q => Q.struct.generator.atomGroups({
        'chain-test': Q.core.rel.eq([Q.struct.atomProperty.macromolecular.chainKey(), chainIndex]),
    }), data);

    return StructureSelection.toLociWithSourceUnits(sel);
}

export const lociForWholeChainAuth = (viewer, structureIndex, chainAuth) => {
    const data = viewer.plugin.managers.structure.hierarchy.current.structures[structureIndex]?.cell.obj?.data;

    const sel = Script.getStructureSelection(Q => Q.struct.generator.atomGroups({
        'chain-test': Q.core.rel.eq([Q.struct.atomProperty.macromolecular.auth_asym_id(), chainAuth]),
    }), data);

    return StructureSelection.toLociWithSourceUnits(sel);
}

export const selectWholeChain = (viewer, structureIndex, chainIndex) => {
    const loci = lociForWholeChain(viewer, structureIndex, chainIndex)
    viewer.plugin.managers.interactivity.lociSelects.select({ loci });
}

export const setVisibility = (viewer, structureIndex, shouldBeVisible) => {
    const data = viewer.plugin.state.data;
    const ref = viewer.plugin.managers.structure.hierarchy.current.structures[structureIndex].cell.transform.ref

    setSubtreeVisibility(data, ref, !shouldBeVisible);
}

/// ===================================
/// ========== SUPERPOSITION ==========
/// ===================================


const getRootStructure = (viewer, structure) => {
    const parent = viewer.plugin.helpers.substructureParent.get(structure);
    const selectedData = viewer.plugin.state.data.selectQ(q => {
        return q.byValue(parent).rootOfType(PluginStateObject.Molecule.Structure)
    });

    return selectedData[0].obj?.data;
}

const transform = async (viewer, stateObjectRef, matrix, coordinateSystem) => {
    const r = StateObjectRef.resolveAndCheck(viewer.plugin.state.data, stateObjectRef);
    if (!r) return;
    const o = viewer.plugin.state.data.selectQ(q => q.byRef(r.transform.ref).subtree().withTransformer(StateTransforms.Model.TransformStructureConformation))[0];

    const transform = coordinateSystem && !Mat4.isIdentity(coordinateSystem.matrix)
        ? Mat4.mul(Mat4(), coordinateSystem.matrix, matrix)
        : matrix;

    const params = {
        transform: {
            name: 'matrix',
            params: { data: transform, transpose: false }
        }
    };
    const b = o
        ? viewer.plugin.state.data.build().to(o).update(params)
        : viewer.plugin.state.data.build().to(stateObjectRef)
            .insert(StateTransforms.Model.TransformStructureConformation, params, { tags: 'SuperpositionTransform' });
    await viewer.plugin.runTask(viewer.plugin.state.data.updateTree(b));
}

export const superposeLoci = async (viewer, locis) => {
    const { query } = StructureSelectionQueries.polymer;

    const remappedLocis = locis.map(loci => {
        const s = StructureElement.Loci.toStructure(loci);
        const loci2 = StructureSelection.toLociWithSourceUnits(query(new QueryContext(s)));
        const rootStructure = getRootStructure(viewer, loci.structure);
        return StructureElement.Loci.remap(loci2, rootStructure);
    }).filter((rl) => rl?.elements?.length);
    if (remappedLocis.length < 2) {
        console.log('Nothing to align after remapping');
        return;
    }
    const entries = locis.map(loci => {
        return {
            cell: viewer.plugin.helpers.substructureParent.get(loci.structure, true)
        };
    });

    const pivot = viewer.plugin.managers.structure.hierarchy.findStructure(remappedLocis[0]?.structure);
    const coordinateSystem = pivot?.transform?.cell.obj?.data.coordinateSystem;

    const transforms = alignAndSuperpose(remappedLocis);

    for (let i = 1, il = remappedLocis.length; i < il; ++i) {
        const eB = entries[i];
        const { bTransform, rmsd } = transforms[i - 1];
        await transform(viewer, eB.cell, bTransform, coordinateSystem);
    }

    await PluginCommands.Camera.Reset(viewer.plugin);
}



function interpolateBky(v) {
    let r, g, b;

    if (v < 0) {
        r = g = b = 0.8;
    } else if (v < 0.5) {
        const s = v*2.0;
        r = 0.128 * s + 0.057 * (1-s);
        g = 0.127 * s + 0.580 * (1-s);
        b = 0.129 * s + 0.981 * (1-s);
    } else {
        const s = (v-0.5)*2;
        r = 0.702 * s + 0.128 * (1-s);
        g = 0.545 * s + 0.127 * (1-s);
        b = 0.102 * s + 0.129 * (1-s);
    }

    function fix16(x) {
        x = 255 * x;
        if (x > 255) x = 255;
        if (x < 0) x = 0;
        let str = (x|0).toString(16);
        if (str.length === 0) str = '0' + str;
        return str;
    }

    return '#' + fix16(r) + fix16(g) + fix16(b);
}
