import React, {useState, useCallback, useMemo, useContext, createContext} from 'react';
import { Menu, MenuItem, Tooltip, Button } from "@mui/material";
import { ArrowRight, ArrowDropDown } from "@mui/icons-material";

export const MenuCloseContext = createContext(() => {});

export function useCloseMenus() {
    const closer = useContext(MenuCloseContext);
    return closer;
}

export default function GMenu({children, onClose, ...props}) {
    const closeMenus = useCloseMenus();
    const gmOnClose = useCallback(() => {
        if (closeMenus) closeMenus();
        if (onClose) onClose();
    }, [closeMenus, onClose]);

    return (
        <Menu {...props} onClose={gmOnClose}>
            { children }
        </Menu>
    )
}

export function GSubMenu({name, icon, disabled, children, id}) {
    const [subMenuAnchor, setSubMenuAnchor] = useState(undefined);

    const showSubMenu = useCallback((event) => {
        setSubMenuAnchor(event.currentTarget);
    }, [])
    
    const hideSubMenu = useCallback(() => {
        setSubMenuAnchor(undefined);
    }, []);

    const outerCloseMenus = useCloseMenus();
    const closeMenus=useCallback(() => {
        if (outerCloseMenus) outerCloseMenus();
        hideSubMenu();
    }, [])

    return (
        <MenuCloseContext.Provider value={closeMenus}>
            <div onMouseEnter={showSubMenu}
                 onMouseLeave={hideSubMenu}>
                <MenuItem 
                    style={{display: 'flex', justifyContent: 'space-between'}}
                >
                    { name }
                    { icon || <ArrowRight /> }
                </MenuItem>

                <Menu
                    style={{pointerEvents: 'none'}}
                    hideBackdrop
                    slotProps={{paper: {sx: {pointerEvents: 'auto'}}}}
                    id={id || name}
                    anchorEl={subMenuAnchor}
                    open={!!subMenuAnchor}
                    onClose={hideSubMenu}
                    anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                    transformOrigin={{vertical: 'top', horizontal: 'left'}}
                >
                    { children }
                </Menu>
            </div>
        </MenuCloseContext.Provider>
    )
}

export function GMenuItem({style={}, onClick, children, noClose=false, ...props}) {
    const closeMenus = useCloseMenus();

    const click = useCallback((ev) => {
        if (closeMenus && !noClose) closeMenus();
        if (onClick) onClick(ev);
    }, [closeMenus, noClose]);

    return (
        <MenuItem style={{...style, pointerEvents: 'auto'}}
                  onClick={click}
                  {...props}>
            { children }
        </MenuItem>
    )
}

export function ExplainDisabledMenuItem({enabledMessage, disabledMessage, children, ...props}) {
    const tooltipMessage = props.disabled ? disabledMessage : enabledMessage;
    
    return (
        <Tooltip title={tooltipMessage} placement='right'>
            <span>
                <GMenuItem {...props}>
                    { children }
                </GMenuItem>
            </span>
        </Tooltip>
    );
}

export function GDropDown({name, icon, id, disabled, compact=false, style, children, ...props}) {
    const [anchor, setAnchor] = useState(undefined);
    const isOpen = !!anchor;

    const outerCloseMenus = useCloseMenus();
    const closeMenus=useCallback(() => {
        if (outerCloseMenus) outerCloseMenus();
        setAnchor(undefined);
    }, [outerCloseMenus]);

    const showMenu = useCallback((ev) => {
        setAnchor(ev.currentTarget);
    }, []);

    const css = useMemo(() => ({
        color: 'primary.text',
        paddingLeft: '6px',
        paddingRight: '6px',
        paddingTop: '3px',
        paddingBottom: '3px',
        border: '1px solid',
        borderColor: '#b4cfdb',
        textTransform: 'none',
        transition: "background-color 0s",

        ':hover': {
            backgroundColor: '#b4cfdb',
        },

        fontSize: compact ? '10px' : '14px',
        padding: compact ? '1px' : null,
        borderRadius: compact ? '5px' : '10px',

        ...(style || {})
    }), [style, compact])

    return (
        <MenuCloseContext.Provider value={closeMenus}>
            <Button sx={css} onClick={showMenu} disabled={disabled}>
                {name}
                {icon || <ArrowDropDown/> }
            </Button>
            <GMenu
                id={id || name}
                anchorEl={anchor}
                open={isOpen}
                onClose={closeMenus}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                {...props}
            >
                { children }
            </GMenu>
        </MenuCloseContext.Provider>
    );
}
